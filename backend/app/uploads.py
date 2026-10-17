"""Consistent validation and storage for customer and catalog images."""
import os
from pathlib import Path
from uuid import uuid4
from flask import current_app

MAX_IMAGE_BYTES = 5 * 1024 * 1024


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


def save_image(data, directory, filename=None):
    extension = image_extension(data, filename)
    name = f'{uuid4().hex}.{extension}'
    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], directory)
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, name), 'wb') as target:
        target.write(data)
    return f'/static/uploads/{directory}/{name}'
