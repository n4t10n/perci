"""Backend v1.4: auth and owner-scoped deletes, mocked PostgREST (no personal data)."""
import unittest
from unittest.mock import patch
from server import perci_server as core

UID='123e4567-e89b-12d3-a456-426614174000'
OTHER='123e4567-e89b-12d3-a456-426614174001'

class DeleteEntitiesContract(unittest.TestCase):
    def test_id_validation_and_atomic_rejection_before_any_request(self):
        for body in (None, {}, {'routines':'r1'}, {'habits':['bad id']},
                     {'records':['x']*101}, {'routines':['ok'], 'unknown':['x']},
                     {'routines':['a'+str(i) for i in range(51)], 'habits':['b'+str(i) for i in range(50)]}):
            with patch.object(core, 'postgres') as request:
                with self.assertRaises(core.ApiError):
                    core.delete_cloud_entities(body, 'jwt', UID)
                request.assert_not_called()

    def test_all_kinds_owner_scoped_and_idempotent(self):
        with patch.object(core, 'postgres', return_value=None) as request:
            out=core.delete_cloud_entities({'routines':['r1','r1'], 'habits':['h1'], 'records':['s1']}, 'jwt', UID)
        self.assertEqual(out['processed'], {'routines':1,'habits':1,'records':1})
        self.assertEqual(request.call_count,3)
        expected={'perci_routines':'routine','perci_habits':'habit','perci_activity_records':'record'}
        for call in request.call_args_list:
            table,jwt=call.args
            self.assertEqual(jwt,'jwt')
            self.assertIn(table,expected)
            self.assertEqual(call.kwargs['method'],'DELETE')
            self.assertEqual(call.kwargs['filters']['user_id'],'eq.'+UID)
            self.assertTrue(call.kwargs['filters']['client_id'].startswith('eq.perci-v04:'+expected[table]+':'))

    def test_cannot_delete_another_owner_by_requested_payload(self):
        # Caller-provided body cannot select owner; it is derived from verified JWT.
        with patch.object(core,'postgres',return_value=None) as req:
            core.delete_cloud_entities({'habits':['h1']},'jwt-A',UID)
            self.assertEqual(req.call_args.kwargs['filters']['user_id'],'eq.'+UID)
            core.delete_cloud_entities({'habits':['h1']},'jwt-B',OTHER)
            self.assertEqual(req.call_args.kwargs['filters']['user_id'],'eq.'+OTHER)

    def test_cascade_contract_in_migration(self):
        from pathlib import Path
        sql=(Path(__file__).parents[1]/'supabase/migrations/202611050001_perci_core.sql').read_text()
        self.assertIn('references public.perci_routines (user_id, id) on delete cascade',sql)
        self.assertIn('references public.perci_habits (user_id, id) on delete cascade',sql)
        self.assertIn('on delete set null (routine_id)',sql)
        self.assertIn('for delete to authenticated',sql)

if __name__=='__main__': unittest.main()
