import unittest
from server import perci_server as core

class TestDecimalDuration(unittest.TestCase):
    def test_valid_minutes(self):
        for value in (1, 14.29, 19.26, 1440):
            with self.subTest(value=value):
                self.assertTrue(core.valid_activity_minutes(value))
                core.verify_snapshot({'routines': [], 'habits': [], 'checks': {}, 'records': [
                    {'id':'run1','type':'run','name':'Running','date':'2026-11-19','minutes':value}]})
        for value in (False, True, None, '19.26', 0, 1440.1, float('inf'), float('nan')):
            with self.subTest(value=value): self.assertFalse(core.valid_activity_minutes(value))
