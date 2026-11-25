"""Tests sin red para el acceso autenticado a fotos solo de amigos aceptados."""
import unittest
from unittest.mock import patch
from pathlib import Path
from server import perci_avatar,perci_social

QA_UID='11111111-1111-4111-8111-111111111111'
FRIEND_UID='22222222-2222-4222-8222-222222222222'
FRIENDSHIP='33333333-3333-4333-8333-333333333333'

class ApiError(Exception):
    def __init__(self,msg,status=400):
        super().__init__(msg)
        self.status=status

class FakeCore:
    ApiError=ApiError
    CONFIG={'url':'https://vafurtauwarukdcopjnh.supabase.co','key':'redacted'}

class TestFriendAvatars(unittest.TestCase):
    def test_bucket_switches_only_for_exact_qa_project(self):
        self.assertEqual(perci_avatar.active_bucket(FakeCore),'perci-avatars-qa')
        class Dev:
            CONFIG={'url':'https://faoilcfpfijyzichwdmj.supabase.co'}
        self.assertEqual(perci_avatar.active_bucket(Dev),'perci-avatars-dev')
        self.assertEqual(perci_avatar._object_path(QA_UID,'jpg',bucket=perci_avatar.active_bucket(FakeCore)),
                         '/storage/v1/object/perci-avatars-qa/'+QA_UID+'/avatar.jpg')

    def test_social_avatar_requires_valid_friendship_and_login(self):
        with self.assertRaises(ApiError):
            perci_social.friend_avatar(FakeCore,'',QA_UID,FRIENDSHIP)
        with self.assertRaises(ApiError):
            perci_social.friend_avatar(FakeCore,'jwt',QA_UID,'../../private')

    def test_denies_no_longer_friends_before_storage(self):
        class Core(FakeCore):
            @staticmethod
            def supabase(*args,**kwargs):return None
        with patch.object(perci_avatar,'fetch') as read:
            with self.assertRaises(ApiError) as ex:
                perci_social.friend_avatar(Core,'jwt',QA_UID,FRIENDSHIP)
            self.assertEqual(ex.exception.status,404)
            read.assert_not_called()

    def test_friend_owner_lookup_uses_the_requesters_jwt_and_qa_bucket(self):
        calls=[]
        class Core(FakeCore):
            @staticmethod
            def supabase(*args,**kwargs):
                calls.append((args,kwargs))
                return FRIEND_UID
        with patch.object(perci_avatar,'fetch',return_value={'present':False,'image':None,'ownerId':FRIEND_UID}) as read:
            result=perci_social.friend_avatar(Core,'jwt-user',QA_UID,FRIENDSHIP)
        self.assertFalse(result['present'])
        self.assertEqual(calls[0][0][0],'/rest/v1/rpc/perci_social_avatar_owner')
        self.assertEqual(calls[0][1]['token'],'jwt-user')
        self.assertEqual(calls[0][1]['data'],{'p_friendship_id':FRIENDSHIP})
        read.assert_called_once_with(Core,'jwt-user',FRIEND_UID)

    def test_sql_authorizes_only_accepted_friend_bucket(self):
        sql=Path('supabase/migrations/202611240003_perci_friend_avatar_read_qa.sql').read_text()
        self.assertIn("f.status='accepted'",sql)
        self.assertIn("bucket_id='perci-avatars-qa'",sql)
        self.assertIn('security definer set search_path',sql)
        self.assertIn('for select to authenticated',sql)
        self.assertNotIn('public=true',sql)
        self.assertNotIn('service_role',sql)
