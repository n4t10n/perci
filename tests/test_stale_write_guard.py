"""Only unit/mocked tests: does not use Supabase live credentials."""
import unittest
from unittest.mock import patch
from server import perci_server as core


def empty():
    return {'routines': [], 'records': [], 'habits': [], 'checks': {}}


class TestStaleWriteGuard(unittest.TestCase):
    def test_modified_remote_habit_requires_reconcile(self):
        previous = empty()
        current = {**empty(), 'habits': [{'id': 'new-h', 'name': 'Agua', 'days': [1], 'paused': False}]}
        with self.assertRaises(core.ApiError) as context:
            core.assert_remote_unchanged(previous, current)
        self.assertEqual(context.exception.status, 409)

    def test_order_of_items_not_conflict(self):
        first = {**empty(), 'habits': [{'id': 'a'}, {'id': 'b'}]}
        second = {**empty(), 'habits': [{'id': 'b'}, {'id': 'a'}]}
        core.assert_remote_unchanged(first, second)

    def test_checked_habit_concurrent_edit_rejected(self):
        old = empty()
        remote = {**empty(), 'checks': {'h:2026-11-06': True}}
        with self.assertRaises(core.ApiError) as context:
            core.assert_remote_unchanged(old, remote)
        self.assertEqual(context.exception.status, 409)

    def test_stale_remote_does_not_make_any_upsert(self):
        old, current = empty(), {**empty(), 'habits': [{'id': 'x'}]}
        with patch.object(core, 'download_data', return_value=current) as read, \
             patch.object(core, 'batch_upsert') as write:
            with self.assertRaises(core.ApiError) as context:
                core.upload_data(empty(), 'jwt-A', 'user-A', expected=old)
            self.assertEqual(context.exception.status, 409)
            read.assert_called_once_with('jwt-A', 'user-A')
            write.assert_not_called()

    def test_remote_read_scope_is_user_id_and_bearer_token(self):
        with patch.object(core, 'postgres', return_value=[]) as postgres:
            core.select_rows('perci_habits', 'jwt-B', 'user-B', 'id,client_id')
            self.assertEqual(postgres.call_args.args[0:2], ('perci_habits', 'jwt-B'))
            self.assertEqual(postgres.call_args.kwargs['filters']['user_id'], 'eq.user-B')
            self.assertNotIn('user-A', repr(postgres.call_args))

    def test_client_cannot_claim_another_account_via_snapshot_user_id(self):
        # The authoritative owner is the verified JWT's `user` argument.
        # A client-provided user_id is ignored by the upsert mapper.
        snapshot = {**empty(), 'habits': [{'id': '1', 'name': 'Agua', 'days': [1], 'paused': False}]}
        with patch.object(core, 'batch_upsert', return_value=[] ) as upsert, \
             patch.object(core, 'select_rows', return_value=[]):
            core.upload_data(snapshot, 'jwt-A', 'user-A', expected=None)
            habit_call = next(c for c in upsert.call_args_list if c.args[0]=='perci_habits')
            self.assertEqual(habit_call.args[1][0]['user_id'], 'user-A')
