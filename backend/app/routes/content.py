from datetime import datetime
from uuid import uuid4
from flask import Blueprint, current_app, request, jsonify
from ..content import validate_faqs, validate_support
from ..admin_validation import FieldValidationError
from ..notifications import enqueue, event

bp = Blueprint('content', __name__, url_prefix='/api')
VALIDATORS = {'faqs': validate_faqs, 'support': validate_support}


@bp.get('/content/<kind>')
def published(kind):
    if kind not in VALIDATORS:
        return jsonify(error='Help content not found.'), 404
    document = current_app.db.settings.find_one({'_id': kind}, {'data': 1, 'revision': 1, 'updatedAt': 1})
    if not isinstance(document, dict):
        return jsonify(error='Help content is temporarily unavailable. Please try again.'), 503
    return jsonify(content=document)


@bp.put('/admin/maintenance/content/<kind>')
def update(kind):
    if kind not in VALIDATORS:
        return jsonify(error='Help content not found.'), 404
    try:
        request_data = request.get_json()
        data = VALIDATORS[kind](request_data.get('data'))
        revision = request_data.get('revision')
        if type(revision) is not int or revision < 1:
            raise FieldValidationError({'revision': 'Reload the latest published content before saving.'})
        timestamp = datetime.utcnow()
        notice = event(f'help:{kind}:{uuid4().hex}', 'store', 'Store help updated',
            'The store FAQs were updated.' if kind == 'faqs' else 'Store contact details were updated.',
            f'/admin/maintenance/{kind}', admins=True)
        result = current_app.db.settings.update_one({'_id': kind, 'revision': revision},
            enqueue({'$set': {'data': data, 'updatedAt': timestamp}, '$inc': {'revision': 1}}, 'settings', kind, notice))
        if not result.modified_count:
            return jsonify(error='Another administrator updated this content. Reload the latest version before saving.'), 409
        return jsonify(success=True, content={'_id': kind, 'data': data, 'revision': revision + 1, 'updatedAt': timestamp})
    except FieldValidationError as failure:
        return failure.response()
