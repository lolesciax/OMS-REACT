"""Consistent validation and storage for customer and catalog images."""
import os
import io
import re
import warnings
from pathlib import Path
from uuid import uuid4
from flask import current_app, abort, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError
from pymongo.errors import PyMongoError
from .rules import RULES

MAX_IMAGE_BYTES = RULES['image']['maxBytes']
MAX_IMAGE_PIXELS = RULES['image']['maxPixels']


def image_extension(data, filename=None):
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise ValueError('Choose an image smaller than 5 MB.')
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        extension = 'png'
    elif data.startswith(b'\xff\xd8\xff'):
        extension = 'jpg'
    elif data[:6] in (b'GIF87a', b'GIF89a'):
        extension = 'gif'
    elif data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        extension = 'webp'
    else:
        raise ValueError('Choose a valid PNG, JPG, GIF or WebP image.')
    if filename:
        supplied = Path(filename).suffix.lower().lstrip('.')
        if supplied == 'jpeg':
            supplied = 'jpg'
        if supplied != extension:
            raise ValueError('The file content does not match its image type.')
    return extension


def sanitized_image(data, filename=None):
    """Decode only supported formats; discard metadata and appended payloads."""
    extension = image_extension(data, filename)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=['PNG', 'JPEG', 'GIF', 'WEBP']) as image:
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise ValueError('Choose an image smaller than 20 megapixels.')
                image.verify()
            with Image.open(io.BytesIO(data), formats=['PNG', 'JPEG', 'GIF', 'WEBP']) as image:
                # A fresh pixel image strips location/EXIF and non-image content.
                frame = ImageOps.exif_transpose(image).convert('RGB' if extension == 'jpg' else 'RGBA')
                clean = Image.new(frame.mode, frame.size)
                clean.paste(frame)
                output = io.BytesIO()
                clean.save(output, format={'jpg': 'JPEG', 'png': 'PNG', 'gif': 'GIF', 'webp': 'WEBP'}[extension])
                result = output.getvalue()
                if len(result) > MAX_IMAGE_BYTES:
                    raise ValueError('Choose a smaller image; the processed file exceeds 5 MB.')
                return result, extension
    except (OSError, SyntaxError, UnidentifiedImageError, Image.DecompressionBombWarning, Image.DecompressionBombError) as error:
        raise ValueError('Choose a complete, valid PNG, JPG, GIF or WebP image.') from error


def save_image(data, directory, filename=None):
    data, extension = sanitized_image(data, filename)
    name = f'{uuid4().hex}.{extension}'
    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], directory)
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, name), 'wb') as target:
        target.write(data)
    return f'/static/uploads/{directory}/{name}'


def serve_image(filename):
    """Payment and receipt attachments are visible only to their owner or staff."""
    from .security import authenticate_session
    if '\\' in filename or any(part in ('.', '..', '') for part in filename.split('/')):
        abort(404)
    pattern = r'^(?:https?://[^/]+)?/(?:api/products/static/uploads|static/uploads|uploads)/' + re.escape(filename) + '$'
    try:
        order = current_app.db.orders.find_one({'$or': [
            {'paymentProof': {'$regex': pattern}}, {'receiptProof': {'$regex': pattern}},
        ]}, {'userId': 1})
        private = filename.split('/')[0] in ('payment_proofs', 'receipts') or Path(filename).name.startswith(('payment_proof_', 'receipt_proof_'))
        if order or private:
            user = authenticate_session()
            if not order or not user:
                abort(404)
            aliases = {str(user['_id']), user.get('username'), user.get('user_id')}
            if not user.get('isAdmin') and str(order.get('userId')) not in aliases:
                abort(404)
            from .rate_limits import limit_user_requests
            blocked = limit_user_requests()
            if blocked is not None:
                return blocked
        response = send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)
        if order or private:
            response.headers['Cache-Control'] = 'private, no-store'
        return response
    except PyMongoError:
        abort(503)
