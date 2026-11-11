"""Validación local, sin Supabase ni credenciales."""
import unittest
from unittest.mock import Mock
from server import perci_share


class ShareValidation(unittest.TestCase):
    def setUp(self):
        self.core = Mock()
        class ApiError(Exception):
            def __init__(self, msg, status=400):
                self.status = status
                super().__init__(msg)
        self.core.ApiError = ApiError
        self.routine = {'name': 'Piernas', 'id': 'no-copy', 'records': ['private'],
                        'exercises': [{'name': 'Sentadilla', 'sets': 3, 'reps': 10, 'weight': 140}]}

    def test_create_sends_only_template_with_caller_token(self):
        self.core.supabase.return_value = 'PERC-AbcdEfgh0123_-Zq'
        result = perci_share.handle(self.core, 'jwt-user-A',
            {'action': 'create', 'sourceId': 'abc', 'routine': self.routine})
        self.assertEqual(result['code'], 'PERC-AbcdEfgh0123_-Zq')
        self.assertEqual(self.core.supabase.call_args.kwargs['token'], 'jwt-user-A')
        clean = self.core.supabase.call_args.kwargs['data']['p_payload']
        self.assertNotIn('records', clean)
        self.assertNotIn('weight', clean['exercises'][0])

    def test_lookup_validation(self):
        self.core.supabase.return_value = self.routine
        result = perci_share.handle(self.core, 'jwt-user-B',
            {'action': 'lookup', 'code': 'PERC-AbcdEfgh0123_-Zq'})
        self.assertEqual(result['routine']['name'], 'Piernas')
        self.assertEqual(len(result['routine']['exercises']), 1)

    def test_invalid_code_never_reaches_server(self):
        with self.assertRaises(self.core.ApiError):
            perci_share.handle(self.core, 'jwt-user-B', {'action':'lookup','code':'PERC-123'})
        self.core.supabase.assert_not_called()

    def test_revocation_requires_owner_in_rpc(self):
        self.core.supabase.return_value = False
        result=perci_share.handle(self.core,'jwt-user-B',
            {'action':'revoke','code':'PERC-AbcdEfgh0123_-Zq'})
        self.assertEqual(result['revoked'],False)
        self.assertEqual(self.core.supabase.call_args.args[0],'/rest/v1/rpc/perci_share_revoke')

    def test_invalid_payload_does_not_reach_db(self):
        with self.assertRaises(self.core.ApiError):
            perci_share.handle(self.core, 'jwt-A',{'action':'create','sourceId':'s',
                'routine':{'name':'x','exercises':[{'name':'x','sets':-1,'reps':10}]}})
        self.core.supabase.assert_not_called()


if __name__ == '__main__': unittest.main()
