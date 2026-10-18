import base64
import re
from datetime import date
from uuid import uuid4
from .uploads import save_image
from .rules import RULES


def text(value, label, required=False, limit=250):
    if value is None and not required:
        return ''
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(f'Enter a valid {label}.')
    value = value.strip()
    if required and not value:
        raise ValueError(f'Enter your {label}.')
    return value


def email(value):
    value = text(value, 'email address', True, RULES['emailMaxLength']).lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
        raise ValueError('Enter a valid email address.')
    local, domain = value.rsplit('@', 1)
    if not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+", local) or len(domain) > 253:
        raise ValueError('Enter a valid email address.')
    labels = domain.split('.')
    if any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in labels) or not re.fullmatch(r'(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})', labels[-1]):
        raise ValueError('Enter a valid email domain, such as example.com.')
    if len(local) > 64 or local.startswith('.') or local.endswith('.') or '..' in value or any(part.startswith('-') or part.endswith('-') for part in domain.split('.')):
        raise ValueError('Enter a valid email address.')
    return value


def username(value):
    value = text(value, 'username', True, 16)
    if not re.fullmatch(r'[A-Za-z0-9_]{3,16}', value):
        raise ValueError('Username must be 3 to 16 letters, numbers or underscores.')
    return value


def password(value):
    if not isinstance(value, str) or not 8 <= len(value) <= 128 or not value.strip():
        raise ValueError('Password must be 8 to 128 characters long.')
    return value


def phone(value, required=False):
    value = text(value, 'mobile number', required, RULES['phoneMaxLength'])
    if value and not re.fullmatch(r'(09\d{9}|\+?639\d{9})', re.sub(r'[\s()-]', '', value)):
        raise ValueError('Enter a valid Philippine mobile number, such as 0912 345 6789.')
    return value


def address(value):
    if not isinstance(value, dict):
        raise ValueError('Enter a valid delivery address.')
    result = {key: text(value.get(key), label, True) for key, label in {
        'recipient': 'recipient name', 'street': 'street address', 'barangay': 'barangay',
        'city': 'city or municipality', 'province': 'province'}.items()}
    result['contact'] = phone(value.get('contact'), True)
    return result


def addresses(value):
    if not isinstance(value, list) or len(value) > 20:
        raise ValueError('Save up to 20 delivery addresses.')
    result, ids = [], set()
    for item in value:
        normalized = address(item)
        key = text(item.get('id') or str(uuid4()), 'address ID', True, 80)
        if key in ids:
            raise ValueError('Address IDs must be unique.')
        ids.add(key)
        if type(item.get('isDefault', False)) is not bool:
            raise ValueError('Choose a valid default address.')
        normalized.update(id=key, title=text(item.get('title') or 'Home', 'address name', True, 80), isDefault=item.get('isDefault', False))
        result.append(normalized)
    if result:
        selected = next((item for item in result if item['isDefault']), result[0])
        for item in result:
            item['isDefault'] = item is selected
    return result


def _profile_value(data, existing=None):
    result = {}
    for key in ('firstName', 'lastName'):
        if key in data:
            from .admin_validation import clean_text
            result[key] = clean_text(data[key], 'first name' if key == 'firstName' else 'last name', RULES['profileNameMaxLength'])
    if 'phone' in data:
        result['phone'] = phone(data['phone'])
    if 'dob' in data:
        birthday = text(data['dob'], 'birthday', limit=10)
        if birthday:
            try:
                from datetime import datetime, timezone, timedelta
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', birthday) or date.fromisoformat(birthday) > datetime.now(timezone(timedelta(hours=8))).date():
                    raise ValueError()
            except ValueError:
                raise ValueError('Choose a valid birthday in the past.')
        result['dob'] = birthday
    if 'gender' in data:
        value = text(data['gender'], 'gender', limit=30)
        from flask import current_app
        options = current_app.db.account_options.find_one({'_id': 'profile'}) or {}
        choices = {'': '', **{item.lower(): item for item in options.get('genders', [])}}
        if existing and existing.get('gender') == value:
            choices[value.lower()] = value
        if value.lower() not in choices:
            raise ValueError('Choose a valid gender option.')
        result['gender'] = choices[value.lower()]
    if 'addresses' in data:
        result['addresses'] = addresses(data['addresses'])
    if 'profilePic' in data:
        picture = data['profilePic']
        if not isinstance(picture, str):
            raise ValueError('Choose a valid profile photo.')
        if picture.startswith('data:image/'):
            try:
                raw = base64.b64decode(picture.split(',', 1)[1], validate=True)
            except (ValueError, IndexError):
                raise ValueError('Choose a valid profile photo.')
            if len(raw) > 2 * 1024 * 1024:
                raise ValueError('Choose a profile photo smaller than 2 MB.')
            result['profilePic'] = save_image(raw, 'avatars')
        elif picture.startswith(('/', 'https://', 'http://')) and len(picture) <= 2000:
            result['profilePic'] = picture
        elif not picture:
            result['profilePic'] = '/default-avatar.svg'
        else:
            raise ValueError('Choose a valid profile photo.')
    return result


def profile(data, existing=None):
    from .admin_validation import FieldValidationError
    result, errors = {}, {}
    for key in ('firstName', 'lastName', 'phone', 'dob', 'gender', 'addresses'):
        if key not in data:
            continue
        try:
            result.update(_profile_value({key: data[key]}, existing))
        except ValueError as error:
            errors[key] = str(error)
    if errors:
        raise FieldValidationError(errors)
    # Validate all text fields before creating a new image file.
    if 'profilePic' in data:
        try:
            result.update(_profile_value({'profilePic': data['profilePic']}, existing))
        except ValueError as error:
            raise FieldValidationError({'profilePic': str(error)}) from error
    return result
