"""Repair legacy numeric strings without changing amounts or stock quantities.

Run `py normalize_catalog.py` to preview, then add --apply to save repairs.
Updates compare the original value so concurrent product edits are preserved.
"""
import argparse
from decimal import Decimal, InvalidOperation
from app import create_app


def numeric_repairs(product):
    repairs = {}
    for field in ('price', 'stock'):
        value = product.get(field)
        if not isinstance(value, str):
            continue
        try:
            number = Decimal(value.strip())
            if not number.is_finite() or number < 0:
                continue
            if field == 'stock':
                if number != number.to_integral_value() or number > 2**63 - 1:
                    continue
                repairs[field] = int(number)
            else:
                converted = float(number)
                if not Decimal(str(converted)).is_finite() or Decimal(str(converted)) != number:
                    continue
                repairs[field] = converted
        except (InvalidOperation, ValueError, OverflowError):
            continue
    return repairs


def normalize_catalog(collection, apply=False):
    counts = {'products': 0, 'fields': 0, 'updated': 0, 'conflicts': 0}
    for product in collection.find({}, {'price': 1, 'stock': 1}):
        repairs = numeric_repairs(product)
        if not repairs:
            continue
        counts['products'] += 1
        counts['fields'] += len(repairs)
        if apply:
            expected = {'_id': product['_id'], **{key: product[key] for key in repairs}}
            result = collection.update_one(expected, {'$set': repairs})
            counts['updated' if result.modified_count else 'conflicts'] += 1
    return counts


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Save the exact numeric conversions')
    options = parser.parse_args()
    app = create_app()
    print(('Applied: ' if options.apply else 'Preview only: ') + str(normalize_catalog(app.db.products, options.apply)))
