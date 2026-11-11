"""Unit tests de sincronización QA v1.7.2: solo mocks, cero red/escrituras."""
import importlib.util
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch, MagicMock

# Aislamos el motor core para que este archivo corra también desde el ZIP sin
# clonar el repo; la suite principal de Perci conserva sus propios imports.
class APIError(Exception):
    def __init__(self, msg, status=400):
        super().__init__(msg)
        self.status = status

mockserver = types.ModuleType('server')
mockcore = types.ModuleType('server.perci_server')
mockcore.ApiError = APIError
mockcore.CONFIG = {'url': 'https://perci-qa123.supabase.co', 'key': 'sb_publishable_fake'}
mockcore.download_data = MagicMock()
mockcore.select_rows = MagicMock(return_value=[])
mockcore.supabase = MagicMock()
mockcore.verify_snapshot = MagicMock()
mockserver.perci_server = mockcore
module_path = Path(__file__).resolve().parents[1] / 'server' / 'perci_atomic.py'
spec = importlib.util.spec_from_file_location('perci_atomic_isolated', module_path)
atomic = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {'server': mockserver, 'server.perci_server': mockcore}):
    spec.loader.exec_module(atomic)

UID = '123e4567-e89b-12d3-a456-426614174000'
EMPTY = {'routines': [], 'records': [], 'habits': [], 'checks': {}}
ENV = {'PERCI_ATOMIC_QA_ENABLED':'YES_QA_ONLY',
       'PERCI_ATOMIC_QA_PROJECT_REF':'perci-qa123'}


class TestAtomicAPI(unittest.TestCase):
    def setUp(self):
        mockcore.CONFIG = {'url':'https://perci-qa123.supabase.co','key':'sb_publishable_fake'}
        mockcore.download_data.reset_mock(return_value=True, side_effect=True)
        mockcore.select_rows.reset_mock(return_value=True, side_effect=True)
        mockcore.select_rows.return_value=[]
        mockcore.verify_snapshot.reset_mock(return_value=True, side_effect=True)
        mockcore.supabase.reset_mock(return_value=True, side_effect=True)
        self.env = patch.dict(os.environ, ENV, clear=True)
        self.env.start()

    def tearDown(self): self.env.stop()

    def test_opt_in_disabled_keeps_old_reads_only(self):
        del os.environ['PERCI_ATOMIC_QA_ENABLED']
        self.assertFalse(atomic.enabled())
        mockcore.download_data.return_value = EMPTY
        self.assertEqual(atomic.download_data('token',UID),EMPTY)

    def test_bad_flag_fails_closed(self):
        os.environ['PERCI_ATOMIC_QA_ENABLED']='yes'
        with self.assertRaises(APIError) as e: atomic.enabled()
        self.assertEqual(e.exception.status,503)

    def test_production_is_never_qa(self):
        os.environ['VERCEL_ENV']='production'
        with self.assertRaises(APIError) as e: atomic.enabled()
        self.assertEqual(e.exception.status,503)

    def test_wrong_project_ref_fails_closed(self):
        mockcore.CONFIG={'url':'https://some-other.supabase.co','key':'x'}
        with self.assertRaises(APIError) as e: atomic.enabled()
        self.assertEqual(e.exception.status,503)

    def test_missing_qa_project_ref_fails_closed(self):
        del os.environ['PERCI_ATOMIC_QA_PROJECT_REF']
        with self.assertRaises(APIError) as e: atomic.enabled()
        self.assertEqual(e.exception.status,503)

    def test_revision_initial_no_row_zero(self):
        mockcore.supabase.return_value=[]
        self.assertEqual(atomic.revision('jwt-A',UID),0)
        self.assertIn('user_id=eq.',mockcore.supabase.call_args.args[0])
        self.assertEqual(mockcore.supabase.call_args.kwargs['token'],'jwt-A')

    def test_revision_read_from_db(self):
        mockcore.supabase.return_value=[{'revision':7}]
        self.assertEqual(atomic.revision('jwt-A',UID),7)

    def test_revision_invalid_fails(self):
        for result in [[{'revision':True}],[{'revision':-1}],{},[{},{}]]:
            mockcore.supabase.return_value=result
            with self.assertRaises(APIError): atomic.revision('jwt-A',UID)

    def test_consistent_download_adds_revision(self):
        mockcore.supabase.side_effect=[[{'revision':4}],[{'revision':4}]]
        mockcore.download_data.return_value=EMPTY
        self.assertEqual(atomic.download_data('jwt-A',UID),{**EMPTY,'revision':4})

    def test_consistency_retry_on_interleaved_update(self):
        mockcore.supabase.side_effect=[[{'revision':3}],[{'revision':4}],
                                      [{'revision':4}],[{'revision':4}]]
        mockcore.download_data.return_value=EMPTY
        self.assertEqual(atomic.download_data('jwt-A',UID)['revision'],4)
        self.assertEqual(mockcore.download_data.call_count,2)

    def test_read_never_returns_torn_snapshot(self):
        mockcore.supabase.side_effect=[[{'revision':i}] for i in range(8)]
        mockcore.download_data.return_value=EMPTY
        with self.assertRaises(APIError) as e: atomic.download_data('jwt-A',UID)
        self.assertEqual(e.exception.status,409)

    def test_invalid_deletions_fail_before_rpc(self):
        for invalid in [[], {'unknown':['x']}, {'routines':['spaced id']},
                        {'records':[1]}, {'habits':[str(i) for i in range(101)]},
                        {'routines':['x']*60,'records':['y']*60}]:
            with self.assertRaises(APIError):
                atomic.commit(EMPTY,'jwt-A',UID,expected={'revision':0},deletions=invalid,atomic=True)
            mockcore.supabase.assert_not_called()

    def test_missing_revision_or_old_client_is_refused(self):
        for expected, version in [(None,True),({'revision':True},True),
                                  ({'revision':-1},True),({'revision':0},False)]:
            with self.assertRaises(APIError) as e:
                atomic.commit(EMPTY,'jwt-A',UID,expected=expected,deletions={},atomic=version)
            self.assertEqual(e.exception.status,409)
        mockcore.supabase.assert_not_called()

    def test_commit_sends_one_rpc_with_jwt_and_deletions(self):
        mockcore.supabase.return_value={'revision':5,'routines':0,'records':0,'habits':0}
        out=atomic.commit(EMPTY,'jwt-A',UID,expected={'revision':4},
                          deletions={'habits':['test-habit']},atomic=True)
        self.assertEqual(out['revision'],5)
        mockcore.supabase.assert_called_once()
        args=mockcore.supabase.call_args
        self.assertEqual(args.args[0],'/rest/v1/rpc/perci_commit_snapshot')
        self.assertEqual(args.kwargs['method'],'POST')
        self.assertEqual(args.kwargs['token'],'jwt-A')
        self.assertEqual(args.kwargs['data']['p_deletions'],{'habits':['test-habit']})
        self.assertEqual(args.kwargs['data']['p_expected_revision'],4)
        self.assertNotIn('user_id',args.kwargs['data'])

    def test_incorrect_revision_confirmation_keeps_outbox(self):
        mockcore.supabase.return_value={'revision':99}
        with self.assertRaises(APIError) as e:
            atomic.commit(EMPTY,'jwt-A',UID,expected={'revision':2},deletions={},atomic=True)
        self.assertEqual(e.exception.status,502)

    def test_conflict_is_propagated(self):
        mockcore.supabase.side_effect=APIError('Conflict',409)
        with self.assertRaises(APIError) as e:
            atomic.commit(EMPTY,'jwt-A',UID,expected={'revision':2},deletions={},atomic=True)
        self.assertEqual(e.exception.status,409)

    def test_atomic_disabled_cannot_write_with_new_client(self):
        del os.environ['PERCI_ATOMIC_QA_ENABLED']
        with self.assertRaises(APIError) as e:
            atomic.commit(EMPTY,'jwt-A',UID,expected={'revision':0},deletions={},atomic=True)
        self.assertEqual(e.exception.status,503)
        mockcore.supabase.assert_not_called()

if __name__=='__main__': unittest.main()
