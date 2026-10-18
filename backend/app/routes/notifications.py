"""An authenticated, owner-scoped inbox. Clients cannot create notifications."""
from datetime import datetime, timezone
from bson import ObjectId
from flask import Blueprint, current_app, g, jsonify, request
from ..notifications import flush_sources

bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')
CATEGORIES = ('orders', 'account', 'inventory', 'store')


def owner_query():
    return {'userId': g.user['_id'], 'audience': {'$in': ['personal', 'admin'] if g.user.get('isAdmin') else ['personal']}}


@bp.get('')
def inbox():
    query = owner_query()
    unread = request.args.get('unread', 'false')
    category = request.args.get('category', 'all')
    limit = request.args.get('limit', '20')
    cursor = request.args.get('cursor')
    if unread not in ('true', 'false') or category not in ('all', *CATEGORIES) or not limit.isascii() or not limit.isdigit() or len(limit) > 2 or not 1 <= int(limit) <= 50:
        return jsonify(error='Choose a valid notification filter and page size.'), 400
    if cursor:
        if not ObjectId.is_valid(cursor):
            return jsonify(error='Invalid notification cursor.'), 400
        query['_id'] = {'$lt': ObjectId(cursor)}
    if unread == 'true':
        query['readAt'] = None
    if category != 'all':
        query['category'] = category
    flush_sources()
    limit = int(limit)
    documents = list(current_app.db.notifications.find(query, {'eventKey': 0, 'userId': 0}).sort('_id', -1).limit(limit + 1))
    has_more = len(documents) > limit
    documents = documents[:limit]
    count = current_app.db.notifications.count_documents({**owner_query(), 'readAt': None})
    return jsonify(notifications=documents, unreadCount=count, hasMore=has_more,
                   nextCursor=str(documents[-1]['_id']) if has_more else None,
                   asOf=datetime.now(timezone.utc).isoformat())


@bp.patch('/<notification_id>/read')
def read(notification_id):
    if not ObjectId.is_valid(notification_id):
        return jsonify(error='Invalid notification ID.'), 400
    value = request.get_json().get('read')
    if type(value) is not bool:
        return jsonify(error='Choose a valid read state.'), 400
    result = current_app.db.notifications.update_one({**owner_query(), '_id': ObjectId(notification_id)},
        {'$set': {'readAt': datetime.utcnow() if value else None}})
    if not result.matched_count:
        return jsonify(error='Notification not found.'), 404
    return jsonify(success=True)


@bp.post('/read-all')
def read_all():
    try:
        value = request.get_json().get('before')
        if not isinstance(value, str) or len(value) > 40:
            raise ValueError()
        before = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if before.tzinfo is None or before > datetime.now(timezone.utc):
            raise ValueError()
    except ValueError:
        return jsonify(error='Refresh the inbox before marking all as read.'), 400
    result = current_app.db.notifications.update_many({**owner_query(), 'readAt': None, 'createdAt': {'$lte': before}},
                                                    {'$set': {'readAt': datetime.utcnow()}})
    return jsonify(success=True, markedCount=result.modified_count)
