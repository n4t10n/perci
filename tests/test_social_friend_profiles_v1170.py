"""Test de API y política de publicación sin conectarse a Supabase."""
import unittest
from unittest.mock import Mock
from pathlib import Path
from server import perci_social
class ApiError(Exception):
    def __init__(self,message,status=400):
        super().__init__(message);self.status=status
class ProfileTest(unittest.TestCase):
    def setUp(self):
        self.core=Mock();self.core.ApiError=ApiError;self.core.supabase.return_value={'published':True}
        self.uid='11111111-1111-4111-8111-111111111111'
    def run_action(self,action,data):
        return perci_social.handle(self.core,'userJwt',self.uid,action,data)
    def test_friend_profile_uses_only_authenticated_rpc(self):
        self.run_action('profile',{'requestId':'22222222-2222-4222-8222-222222222222'})
        c=self.core.supabase.call_args
        self.assertEqual(c.args[0],'/rest/v1/rpc/perci_social_friend_profile')
        self.assertEqual(c.kwargs['token'],'userJwt')
        self.assertEqual(c.kwargs['data'],{'p_friendship_id':'22222222-2222-4222-8222-222222222222'})
    def test_publish_sanitizes_unknown_fields(self):
        self.run_action('publishRoutine',{'sourceId':'r-1','routine':{'name':'Torso','secret':'invisible','exercises':[{'name':'Press','sets':3,'reps':10,'weight':90,'history':[100]}]}})
        payload=self.core.supabase.call_args.kwargs['data']['p_payload']
        self.assertEqual(payload,{'name':'Torso','exercises':[{'name':'Press','sets':3,'reps':10}]})
        self.assertEqual(self.core.supabase.call_args.kwargs['token'],'userJwt')
    def test_rejects_bad_routine_without_network(self):
        with self.assertRaises(ApiError):
            self.run_action('publishRoutine',{'sourceId':'r1','routine':{'name':'Torso','exercises':[{'name':'Press','sets':3,'reps':10.2}]}})
        self.core.supabase.assert_not_called()
    def test_rejects_unknown_friend_and_bio_too_long(self):
        with self.assertRaises(ApiError):self.run_action('profile',{'requestId':'../other'})
        with self.assertRaises(ApiError):self.run_action('bio',{'bio':'x'*161})
        self.core.supabase.assert_not_called()
    def test_sql_is_opt_in_and_friend_only(self):
        sql=Path('supabase/migrations/202611240004_perci_friend_profiles_qa.sql').read_text()
        self.assertIn("f.status='accepted'",sql)
        self.assertIn('f.requester_id=me or f.recipient_id=me',sql)
        self.assertIn('enable row level security',sql)
        self.assertIn('revoke all on public.perci_social_routines',sql)
        self.assertNotIn('service_role',sql)
        self.assertNotIn('perci_activity_records',sql)
        self.assertNotIn('perci_workout_sets',sql)
        self.assertNotIn('auth.users u',sql)
if __name__=='__main__': unittest.main()
