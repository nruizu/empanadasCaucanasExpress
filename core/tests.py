from django.test import TestCase

# Create your tests here.
class SimpleTest(TestCase):
    def test_ci(self):
        self.assertEqual(1, 2)