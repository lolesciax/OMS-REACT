import unittest
from unittest.mock import MagicMock, patch
from bson import ObjectId
from flask import Flask, g
from app.notifications import OUTBOX, enqueue, order_event, stock_update, deliver_after_response
from app import MongoJSONProvider
from pymongo.errors import ConnectionFailure


class NotificationTests(unittest.TestCase):
    def test_automatic_completion_and_long_references_are_clear_to_the_customer(self):
        from datetime import datetime
        order = {'_id': ObjectId(), 'userId': ObjectId(), 'orderNumber': 'ORD-' + 'A' * 40, 'autoCompletedAt': datetime.utcnow()}
        notice = order_event(order, 'completed')
        self.assertIn('completed automatically', notice['message'])
        self.assertIn('has not arrived', notice['message'])
        self.assertNotIn('A' * 40, notice['message'])

    def test_outbox_is_part_of_the_business_update_and_tracks_committed_sources(self):
        app = Flask(__name__)
        order_id, user_id = ObjectId(), ObjectId()
        event = order_event({'_id': order_id, 'userId': user_id, 'orderNumber': 'ORD-TEST'}, 'created')
        with app.test_request_context():
            update = enqueue({'$set': {'status': 'pending_payment'}}, 'orders', order_id, event)
            self.assertEqual(update['$set'], {'status': 'pending_payment'})
            self.assertEqual(update['$push'][OUTBOX]['$each'], [event])
            self.assertEqual(g.notification_sources, {('orders', order_id)})

    def test_json_responses_never_expose_outbox_recipients_or_inventory_cycle(self):
        app = Flask(__name__)
        provider = MongoJSONProvider(app)
        result = provider.dumps({'order': {'_id': ObjectId(), OUTBOX: [{'secret': 'internal'}]}, 'items': [{'stockNoticeCycle': 'internal', 'name': 'Shirt'}]})
        self.assertNotIn('internal', result)
        self.assertIn('Shirt', result)

    def test_failed_http_actions_do_not_dispatch_and_notification_failure_preserves_success(self):
        app = Flask(__name__)
        app.db = MagicMock()
        with app.test_request_context():
            g.notification_sources = {('orders', ObjectId())}
            with patch('app.notifications.deliver_source', side_effect=ConnectionFailure('test')) as deliver:
                response = app.response_class(status=400)
                self.assertIs(deliver_after_response(response), response)
                deliver.assert_not_called()
                response = app.response_class(status=201)
                self.assertEqual(deliver_after_response(response).status_code, 201)
                deliver.assert_called_once()

    def test_one_failed_source_does_not_block_another_account(self):
        from app.notifications import flush_sources
        app = Flask(__name__)
        app.db = MagicMock()
        with app.app_context(), patch('app.notifications.deliver_source', side_effect=[ConnectionFailure('test'), None]) as deliver:
            flush_sources([('orders', ObjectId()), ('users', ObjectId())])
            self.assertEqual(deliver.call_count, 2)

    def test_inventory_notices_share_a_cycle_until_stock_is_replenished(self):
        product = {'_id': ObjectId(), 'name': 'Shirt', 'stock': 5, 'stockNoticeCycle': 'old'}
        reduced = stock_update(product, {'stock': 3})
        self.assertIn(':old:low', reduced['$push'][OUTBOX]['$each'][0]['key'])
        restock = stock_update(product, {'stock': 10})
        self.assertNotEqual(restock['$set']['stockNoticeCycle'], 'old')
        self.assertNotIn('$push', restock)
