"""Maintainable choices used by the product catalog."""

DEFAULT_CATALOG_OPTIONS = {
    'categories': ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Footwear', 'Accessories'],
    'sizes': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One size'],
    'materials': ['Cotton', 'Denim', 'Polyester', 'Wool', 'Leather', 'Linen'],
}


def catalog_options(db):
    saved = db.catalog_options.find_one({'_id': 'product'}) or {}
    return {
        key: saved.get(key, defaults)
        for key, defaults in DEFAULT_CATALOG_OPTIONS.items()
    }
