from flask import Blueprint, current_app, jsonify, request
from ..policies import current_policy, DEFAULTS
from ..admin_validation import collect, clean_text, FieldValidationError
from datetime import datetime
from ..notifications import enqueue, event

bp = Blueprint('policies', __name__, url_prefix='/api')


@bp.get('/policies/<kind>')
def published(kind):
    if kind not in DEFAULTS:
        return jsonify(error='Policy not found.'), 404
    try:
        return jsonify(policy=current_policy(kind))
    except FieldValidationError:
        return jsonify(error='This policy is temporarily unavailable. Please try again.'), 503


@bp.route('/admin/maintenance/policies/<kind>', methods=['PUT'])
def publish(kind):
    if kind not in DEFAULTS:
        return jsonify(error='Policy not found.'), 404
    try:
        old = current_policy(kind)
        data = request.get_json()
        values = collect({'title': lambda: clean_text(data.get('title'), 'policy title', 150, True),
                          'body': lambda: clean_text(data.get('body'), 'policy text', 20000, True, multiline=True)})
        if data.get('version') != str(old['_id']):
            return jsonify(error='Another administrator updated these terms. Reload before publishing.'), 409
        version = {**values, 'kind': kind, 'publishedAt': datetime.utcnow()}
        identifier = current_app.db.policy_versions.insert_one(version).inserted_id
        notice = event(f'policy:{identifier}', 'store', 'Store policy updated', f'A new version of {values["title"]} was published.', '/admin/maintenance/policies', admins=True)
        result = current_app.db.settings.update_one({'_id': 'terms', kind: old['_id']}, enqueue({'$set': {kind: identifier}}, 'settings', 'terms', notice))
        if not result.modified_count:
            return jsonify(error='The policy changed while saving. Reload before publishing.'), 409
        return jsonify(success=True, policy={**version, '_id': identifier})
    except FieldValidationError as error:
        return error.response()
