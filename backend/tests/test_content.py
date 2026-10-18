import unittest
from app.content import validate_faqs, validate_support, DEFAULT_SUPPORT
from app.admin_validation import FieldValidationError


class HelpValidationTests(unittest.TestCase):
    def test_faqs_validate_every_question_and_answer(self):
        with self.assertRaises(FieldValidationError) as failure:
            validate_faqs([{'id': 'first', 'question': '', 'answer': ''}])
        self.assertEqual(set(failure.exception.fields), {'question-0', 'answer-0'})

    def test_faqs_reject_duplicate_ids_and_excessive_content(self):
        valid = {'id': 'first', 'question': 'A question?', 'answer': 'An answer.'}
        for value in ([], [valid] * 51, [valid, valid], [{**valid, 'answer': 'x' * 5001}], [{**valid, 'id': 'bad id'}]):
            with self.subTest(value_type=type(value)), self.assertRaises(FieldValidationError):
                validate_faqs(value)

    def test_faqs_store_plain_text_without_accepting_extra_properties(self):
        value = {'id': 'first', 'question': ' A question? ', 'answer': '<script>alert(1)</script>', 'unsafe': True}
        self.assertEqual(validate_faqs([value]), [{'id': 'first', 'question': 'A question?', 'answer': '<script>alert(1)</script>'}])

    def test_support_validates_email_phone_and_required_details(self):
        self.assertEqual(validate_support(DEFAULT_SUPPORT), DEFAULT_SUPPORT)
        with self.assertRaises(FieldValidationError) as failure:
            validate_support({**DEFAULT_SUPPORT, 'email': 'a@-invalid.com', 'phone': '123', 'hours': ''})
        self.assertEqual(set(failure.exception.fields), {'email', 'phone', 'hours'})

    def test_control_characters_are_rejected(self):
        with self.assertRaises(FieldValidationError):
            validate_faqs([{'id': 'first', 'question': 'Q\x00?', 'answer': 'A'}])
        with self.assertRaises(FieldValidationError):
            validate_support({**DEFAULT_SUPPORT, 'location': 'Place\x00'})
