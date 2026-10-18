import unittest
from app.workspace_preferences import SIDEBAR_ITEMS, validate_workspace_preferences


class WorkspacePreferencesTests(unittest.TestCase):
    def test_only_complete_order_with_maintenance_last_and_bounded_width(self):
        valid = {'sidebarOrder': list(SIDEBAR_ITEMS), 'sidebarWidth': 280}
        self.assertEqual(validate_workspace_preferences(valid), valid)
        for data in (
            None, [], {}, {**valid, 'userId': 'someone-else'},
            {**valid, 'sidebarOrder': list(reversed(SIDEBAR_ITEMS))},
            {**valid, 'sidebarOrder': ['maintenance'] * 7},
            {**valid, 'sidebarOrder': [*SIDEBAR_ITEMS[:-1], {'$ne': None}]},
            {**valid, 'sidebarWidth': True}, {**valid, 'sidebarWidth': 219},
            {**valid, 'sidebarWidth': 361}, {**valid, 'sidebarWidth': 250.5},
        ):
            with self.subTest(data=data), self.assertRaises(ValueError):
                validate_workspace_preferences(data)
