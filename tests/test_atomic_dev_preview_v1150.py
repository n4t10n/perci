"""Autoriza DEV Preview exacto; deniega otros entornos y destinos. Sin red."""
import os
import unittest
from unittest.mock import patch
from server import perci_atomic as atomic

PROJECT = 'faoilcfpfijyzichwdmj'
URL = f'https://{PROJECT}.supabase.co'
MAIN_VERCEL = 'prj_vsYW5BNPSo3gjH2N7paREVKiEvln'
DEV_VERCEL = 'prj_d6yvCQhvCkWwlzRtVWYHZogKkcCv'
QA_VERCEL = 'prj_UDbeNBlrav1Na2Hwtpa168cV7dnw'

class TestDevPreviewAtomicGuard(unittest.TestCase):
    def enabled(self, *, environment='preview', vercel=DEV_VERCEL, url=URL,
                ref=PROJECT, flag='YES_DEV_ATOMIC', qa_flag=None):
        values = {'VERCEL_ENV':environment, 'VERCEL_PROJECT_ID':vercel,
                  'PERCI_ATOMIC_DEV_ENABLED':flag,
                  'PERCI_ATOMIC_DEV_PROJECT_REF':ref}
        if qa_flag is not None:
            values['PERCI_ATOMIC_QA_ENABLED'] = qa_flag
        with patch.dict(os.environ, values, clear=True):
            with patch.object(atomic.core, 'CONFIG', {'url':url,'key':'sb_publishable_test'}):
                return atomic.enabled()

    def test_preview_only_matching_dev_project(self):
        self.assertTrue(self.enabled())

    def test_original_production_guard_still_works(self):
        self.assertTrue(self.enabled(environment='production',vercel=MAIN_VERCEL))

    def test_preview_rejects_other_vercel_projects(self):
        for project in [MAIN_VERCEL,QA_VERCEL,'prj_unknown']:
            with self.subTest(project=project):
                with self.assertRaises(atomic.core.ApiError) as error:
                    self.enabled(vercel=project)
                self.assertEqual(error.exception.status,503)

    def test_production_rejects_new_dev_project(self):
        with self.assertRaises(atomic.core.ApiError):
            self.enabled(environment='production',vercel=DEV_VERCEL)

    def test_development_rejected(self):
        with self.assertRaises(atomic.core.ApiError):
            self.enabled(environment='development')

    def test_wrong_supabase_or_missing_ref_rejected(self):
        for opts in [{'url':'https://vafurtauwarukdcopjnh.supabase.co'},
                     {'ref':'vafurtauwarukdcopjnh'},
                     {'ref':''}]:
            with self.subTest(opts=opts):
                with self.assertRaises(atomic.core.ApiError):
                    self.enabled(**opts)

    def test_invalid_or_conflicting_flags_fail_closed(self):
        with self.assertRaises(atomic.core.ApiError):
            self.enabled(flag='not-enabled')
        with self.assertRaises(atomic.core.ApiError):
            self.enabled(qa_flag='YES_QA_ONLY')

if __name__ == '__main__':
    unittest.main()
