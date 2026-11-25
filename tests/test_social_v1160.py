"""QA Social contract: no network, no database, exact schema and auth guards."""
import unittest
from pathlib import Path
from unittest.mock import Mock
from server import perci_social

ROOT=Path(__file__).resolve().parents[1]
class ApiError(Exception):
    def __init__(self,msg,status=400):
        self.status=status
        super().__init__(msg)

class SocialAPITest(unittest.TestCase):
    def setUp(self):
        self.core=Mock()
        self.core.ApiError=ApiError
        self.core.supabase.return_value={'friends':[]}
        self.uid='123e4567-e89b-12d3-a456-426614174000'
    def call(self,action,body=None):
        return perci_social.handle(self.core,'jwt-A',self.uid,action,body)
    def test_requires_login(self):
        with self.assertRaises(ApiError):perci_social.handle(self.core,'',self.uid,'overview')
        self.core.supabase.assert_not_called()
    def test_allows_no_unchecked_actions(self):
        with self.assertRaises(ApiError):self.call('read_all_users')
        self.core.supabase.assert_not_called()
    def test_exact_invite_code(self):
        for bad in ['','abc','vafurtauwarukdcopjnh','12345678FFFFFFFFDROP']:
            with self.subTest(bad=bad):
                with self.assertRaises(ApiError):self.call('invite',{'code':bad})
        self.core.supabase.assert_not_called()
    def test_overview_uses_jwt_not_service_role(self):
        self.call('overview')
        args=self.core.supabase.call_args
        self.assertEqual(args.args[0],'/rest/v1/rpc/perci_social_overview')
        self.assertEqual(args.kwargs['token'],'jwt-A')
    def test_accept_needs_uuid(self):
        with self.assertRaises(ApiError):self.call('accept',{'requestId':'../../hello'})
        self.core.supabase.assert_not_called()
    def test_setup_name_length(self):
        with self.assertRaises(ApiError):self.call('setup',{'name':'a'})
        self.core.supabase.assert_not_called()
    def test_migration_protects_private_data(self):
        sql=(ROOT/'supabase/migrations/202611240001_perci_social_qa.sql').read_text()
        self.assertIn('security definer set search_path',sql)
        self.assertIn('enable row level security',sql)
        self.assertIn('from public,anon,authenticated',sql)
        self.assertIn('auth.uid()',sql)
        self.assertNotIn('service_role',sql)
        self.assertNotIn('perci_activity_records',sql)
        self.assertNotIn('perci_workout_sets',sql)

if __name__=='__main__':unittest.main()
