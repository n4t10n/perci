"""Pruebas sin red del transporte de perfil v1.7.3.

Ninguna llamada toca Supabase; respuestas mockeadas por cuenta.
"""
import unittest
from unittest.mock import patch
from server import perci_atomic as atomic

EMPTY={'routines': [], 'records': [], 'habits': [], 'checks': {}}
USER_A='123e4567-e89b-12d3-a456-426614174000'

class ProfileDownloadTests(unittest.TestCase):
    def run_fetch(self, profiles, revisions=(3,3)):
        with patch.object(atomic, 'enabled', return_value=True), \
             patch.object(atomic, 'revision', side_effect=revisions), \
             patch.object(atomic.core, 'download_data', return_value=dict(EMPTY)), \
             patch.object(atomic.core, 'select_rows', return_value=profiles) as select:
            data=atomic.download_data('fake-jwt', USER_A)
        select.assert_called_with('perci_profiles','fake-jwt',USER_A,'theme,focus,onboarding_done')
        return data

    def test_existing_account_restores_onboarding_and_preferences(self):
        data=self.run_fetch([{'theme':'light','focus':'gym','onboarding_done':True}])
        self.assertEqual(data['revision'],3)
        self.assertIs(data['onboardSeen'],True)
        self.assertEqual(data['theme'],'light')
        self.assertEqual(data['focus'],'gym')

    def test_first_account_no_profile_stays_unconfigured(self):
        data=self.run_fetch([])
        self.assertNotIn('onboardSeen',data)
        self.assertNotIn('theme',data)
        self.assertNotIn('focus',data)

    def test_existing_unfinished_account_remains_unfinished(self):
        data=self.run_fetch([{'theme':'dark','focus':'both','onboarding_done':False}])
        self.assertIs(data['onboardSeen'],False)

    def test_invalid_profile_never_silently_defaults(self):
        with self.assertRaises(atomic.core.ApiError):
            self.run_fetch([{'theme':'invalid','focus':'gym','onboarding_done':True}])

    def test_profile_fenced_by_revision_retry(self):
        with patch.object(atomic,'enabled',return_value=True), \
             patch.object(atomic,'revision',side_effect=[0,1,1,1]), \
             patch.object(atomic.core,'download_data',return_value=dict(EMPTY)), \
             patch.object(atomic.core,'select_rows',return_value=[{'theme':'system','focus':'others','onboarding_done':True}]) as profiles:
            data=atomic.download_data('fake-jwt',USER_A)
            self.assertEqual(profiles.call_count,2)
            self.assertEqual(data['revision'],1)

if __name__=='__main__':unittest.main()
