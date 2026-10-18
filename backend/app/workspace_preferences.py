"""Validated per-account workspace presentation; never grants navigation access."""
SIDEBAR_ITEMS = ('dashboard', 'products', 'orders', 'customers', 'discounts', 'notifications', 'maintenance')


def validate_workspace_preferences(data):
    if not isinstance(data, dict) or set(data) != {'sidebarOrder', 'sidebarWidth'}:
        raise ValueError('Send the sidebar order and width only.')
    order, width = data['sidebarOrder'], data['sidebarWidth']
    if (not isinstance(order, list) or len(order) != len(SIDEBAR_ITEMS)
            or any(not isinstance(item, str) for item in order)
            or set(order) != set(SIDEBAR_ITEMS) or order[-1] != 'maintenance'):
        raise ValueError('Include each workspace section once, with Maintenance last.')
    if type(width) is not int or not 220 <= width <= 360:
        raise ValueError('Sidebar width must be a whole number between 220 and 360 pixels.')
    return {'sidebarOrder': order, 'sidebarWidth': width}
