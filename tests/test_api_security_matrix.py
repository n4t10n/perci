"""Percí API security matrix: mocked HTTP, NO production calls or credentials.

Run from Percí repository with:
 python -m unittest discover -s tests -p 'test_*.py' -q
"""
import copy
import http.server
import json
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
from api import shared


class Handler(shared.ApiHandler):
    pass


USER_A = '11111111-1111-4111-8111-111111111111'
USER_B = '22222222-2222-4222-8222-222222222222'
EMPTY = {'routines': [], 'records': [], 'habits': [], 'checks': {}}


class APISecurityMatrix(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def request(self, method, path, body=None, *, origin=None, content_type='application/json', cookies=''):
        headers = {}
        if origin is not None:
            headers['Origin'] = origin
        if content_type is not None:
            headers['Content-Type'] = content_type
        if cookies:
            headers['Cookie'] = cookies
        raw = None if body is None else json.dumps(body).encode('utf-8')
        req = urllib.request.Request(self.url + path, data=raw, headers=headers, method=method)
        try:
            response = urllib.request.urlopen(req, timeout=3)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            text = response.read().decode('utf-8')
            return response.status, json.loads(text), response.headers

    def post(self, path, body, **kw):
        return self.request('POST', path, body, origin=self.url, **kw)

    def test_01_anonymous_cannot_read(self):
        with patch.object(Handler, 'authenticated', return_value=(None, None, ())):
            code, payload, _ = self.request('GET', '/api/cloud/data')
            self.assertEqual(code, 401)
            self.assertNotIn('routines', payload)

    def test_02_anonymous_cannot_write_or_delete(self):
        with patch.object(Handler, 'authenticated', return_value=(None, None, ())), \
             patch.object(shared.core, 'upload_data') as write, \
             patch.object(shared.core, 'delete_cloud_entities') as delete:
            for path, body in [('/api/cloud/sync', {'snapshot': EMPTY}),
                               ('/api/cloud/delete', {'habits': ['anything']})]:
                code, payload, _ = self.post(path, body)
                self.assertEqual(code, 401, path)
            write.assert_not_called()
            delete.assert_not_called()

    def test_03_missing_origin_blocked_before_write(self):
        with patch.object(Handler, 'authenticated', return_value=('jwt-A', {'id': USER_A}, ())), \
             patch.object(shared.core, 'upload_data') as write:
            code, payload, _ = self.request('POST', '/api/cloud/sync', {'snapshot': EMPTY})
            self.assertEqual(code, 403)
            write.assert_not_called()

    def test_04_other_origin_blocked_before_write(self):
        with patch.object(Handler, 'authenticated', return_value=('jwt-A', {'id': USER_A}, ())), \
             patch.object(shared.core, 'upload_data') as write:
            for origin in ['https://attacker.example', self.url + '.attacker.example', 'null']:
                code, payload, _ = self.request('POST', '/api/cloud/sync', {'snapshot': EMPTY}, origin=origin)
                self.assertEqual(code, 403, origin)
            write.assert_not_called()

    def test_05_wrong_content_type_refused_before_write(self):
        with patch.object(Handler, 'authenticated', return_value=('jwt-A', {'id': USER_A}, ())), \
             patch.object(shared.core, 'upload_data') as write:
            code, payload, _ = self.post('/api/cloud/sync', {'snapshot': EMPTY}, content_type='text/plain')
            self.assertEqual(code, 415)
            write.assert_not_called()

    def test_06_authenticated_query_param_cannot_change_read_owner(self):
        with patch.object(Handler, 'authenticated', return_value=('jwt-B', {'id': USER_B}, ())), \
             patch.object(shared.core, 'download_data', return_value=EMPTY) as read:
            code, payload, _ = self.request('GET', '/api/cloud/data?user_id='+USER_A)
            self.assertEqual(code, 200)
            read.assert_called_once_with('jwt-B', USER_B)

    def test_07_authenticated_payload_cannot_change_write_owner(self):
        snap = {**EMPTY, 'user_id': USER_A,
                'habits': [{'id': 'test', 'name': 'Test', 'days': [1], 'user_id': USER_A}]}
        with patch.object(Handler, 'authenticated', return_value=('jwt-B', {'id': USER_B}, ())), \
             patch.object(shared.core, 'upload_data', return_value={'habits': 1}) as write:
            code, payload, _ = self.post('/api/cloud/sync', {'user_id': USER_A, 'snapshot': snap})
            self.assertEqual(code, 200)
            write.assert_called_once_with(snap, 'jwt-B', USER_B, expected=None)

    def test_08_delete_body_cannot_change_authenticated_owner(self):
        with patch.object(Handler, 'authenticated', return_value=('jwt-B', {'id': USER_B}, ())), \
             patch.object(shared.core, 'delete_cloud_entities', return_value={'processed': {'habits': 1}}) as delete:
            code, payload, _ = self.post('/api/cloud/delete', {'user_id': USER_A, 'habits': ['test']})
            self.assertEqual(code, 200)
            delete.assert_called_once_with({'user_id': USER_A, 'habits': ['test']}, 'jwt-B', USER_B)

    def test_09_core_rejects_delete_payload_with_owner_override(self):
        with patch.object(shared.core, 'postgres') as pg:
            with self.assertRaises(shared.core.ApiError) as err:
                shared.core.delete_cloud_entities({'user_id': USER_A, 'habits': ['test']}, 'jwt-B', USER_B)
            self.assertEqual(err.exception.status, 400)
            pg.assert_not_called()

    def test_10_core_delete_filters_are_owner_scoped(self):
        with patch.object(shared.core, 'postgres', return_value=[]) as pg:
            shared.core.delete_cloud_entities({'routines': ['test1'], 'records': ['test2'],
                                               'habits': ['test3']}, 'jwt-B', USER_B)
            self.assertEqual(pg.call_count, 3)
            for call in pg.call_args_list:
                self.assertEqual(call.args[1], 'jwt-B')
                self.assertEqual(call.kwargs['filters']['user_id'], 'eq.' + USER_B)

    def test_11_core_upsert_ignores_nested_owner_override(self):
        snap = copy.deepcopy(EMPTY)
        snap['habits'] = [{'id':'q1','name':'Prueba','days':[1], 'user_id': USER_A}]
        with patch.object(shared.core, 'batch_upsert', return_value=[]) as upsert, \
             patch.object(shared.core, 'select_rows', return_value=[]):
            shared.core.upload_data(snap, 'jwt-B', USER_B)
            for call in upsert.call_args_list:
                for row in call.args[1]:
                    self.assertEqual(row['user_id'], USER_B)

    def test_12_stale_write_is_denied_before_db_mutation(self):
        remote = {**EMPTY, 'habits': [{'id': 'r1', 'name': 'Remote', 'days': [1]}]}
        with patch.object(shared.core, 'download_data', return_value=remote), \
             patch.object(shared.core, 'batch_upsert') as upsert:
            with self.assertRaises(shared.core.ApiError) as err:
                shared.core.upload_data(EMPTY, 'jwt-B', USER_B, expected=EMPTY)
            self.assertEqual(err.exception.status, 409)
            upsert.assert_not_called()

    def test_13_session_response_never_contains_cookie_tokens(self):
        with patch.object(Handler, 'authenticated', return_value=('secret-token', {'id': USER_B, 'email': 'b@example.test'}, ())):
            code, payload, head = self.request('GET', '/api/auth/session')
            self.assertEqual(code, 200)
            self.assertEqual(payload['user']['email'], 'b@example.test')
            self.assertNotIn('secret-token', json.dumps(payload))
            self.assertIn('no-store', head['Cache-Control'])

    def test_15_malformed_snapshot_returns_400_not_500_and_writes_nothing(self):
        invalid_snapshots = [
            {**EMPTY, 'routines': [123]},
            {**EMPTY, 'records': [None]},
            {**EMPTY, 'habits': ['not a habit']},
            {**EMPTY, 'routines': [{'id': 'r', 'name': 'R', 'exercises': ['oops']}]},
            {**EMPTY, 'checks': 'invalid'},
        ]
        with patch.object(Handler, 'authenticated', return_value=('jwt-B', {'id': USER_B}, ())), \
             patch.object(shared.core, 'batch_upsert') as writes:
            for snapshot in invalid_snapshots:
                code, payload, _ = self.post('/api/cloud/sync', {'snapshot': snapshot})
                self.assertEqual(code, 400, repr(snapshot))
                self.assertIn('error', payload)
            writes.assert_not_called()

    def test_16_server_logs_strip_query_strings(self):
        import contextlib
        import io
        output = io.StringIO()
        with patch.object(Handler, 'authenticated', return_value=(None, None, ())):
            with contextlib.redirect_stdout(output):
                code, _, _ = self.request('GET', '/api/cloud/data?access_token=DO_NOT_LOG_ME')
        self.assertEqual(code, 401)
        self.assertNotIn('DO_NOT_LOG_ME', output.getvalue())
        self.assertIn('/api/cloud/data', output.getvalue())

    def test_14_oversized_content_length_rejected_before_upload(self):
        # Avoid sending huge bodies: verify Content-Length guard by injecting a fake handler.
        import io
        class Fake:
            headers = {'Origin': 'https://perci.example', 'Host': 'perci.example',
                       'Content-Type': 'application/json', 'Content-Length': str(shared.MAX_BODY + 1)}
            secure = staticmethod(lambda: True)
            rfile = io.BytesIO(b'{}')
        with self.assertRaises(shared.core.ApiError) as err:
            shared.ApiHandler.check_post(Fake())
        self.assertEqual(err.exception.status, 413)


if __name__ == '__main__':
    unittest.main()
