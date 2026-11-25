"""Contrato Social v1.16.1. No usa red ni base real."""
import unittest
from pathlib import Path
from unittest.mock import Mock
from server import perci_social

class ApiError(Exception):
    def __init__(self, message, status=400):
        self.status=status
        super().__init__(message)

class LookupContract(unittest.TestCase):
    def setUp(self):
        self.core=Mock()
        self.core.ApiError=ApiError
        self.core.supabase.return_value={'found':False}
        self.uid='123e4567-e89b-12d3-a456-426614174000'
    def call(self,action,body):
        return perci_social.handle(self.core,'jwt',self.uid,action,body)
    def test_username_search_authenticated(self):
        self.call('find',{'mode':'username','query':'vale_ux'})
        self.assertEqual(self.core.supabase.call_args.args[0],'/rest/v1/rpc/perci_social_find')
        self.assertEqual(self.core.supabase.call_args.kwargs['token'],'jwt')
        self.assertEqual(self.core.supabase.call_args.kwargs['data'],{'p_query':'vale_ux','p_mode':'username'})
    def test_exact_email_search(self):
        self.call('find',{'mode':'email','query':'test@example.com'})
        self.assertEqual(self.core.supabase.call_args.kwargs['data']['p_query'],'test@example.com')
    def test_requires_optin_boolean(self):
        with self.assertRaises(ApiError):self.call('settings',{'username':'vale_ux','emailDiscoverable':'true'})
        self.core.supabase.assert_not_called()
    def test_rejects_bad_queries(self):
        for q in ['vale ux','a','a' * 25,'../admin']:
            with self.subTest(q=q):
                with self.assertRaises(ApiError):self.call('find',{'mode':'username','query':q})
        self.core.supabase.assert_not_called()
    def test_sql_privacy(self):
        sql=Path('supabase/migrations/202611240002_perci_social_lookup_qa.sql').read_text()
        self.assertIn('p.email_discoverable=true',sql)
        self.assertIn('security definer set search_path',sql)
        self.assertIn('count_recent>=30',sql)
        self.assertIn('enable row level security',sql)
        self.assertIn('from public,anon,authenticated',sql)
        self.assertIn("'emailDiscoverable',p.email_discoverable",sql)
