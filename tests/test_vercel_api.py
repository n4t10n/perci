"""Serverless-compatible API contract tests. No real Supabase call is made."""
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


class TestVercelAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def call(self, path, body=None, *, cookie='', origin=True):
        headers = {}
        if body is not None:
            headers['Content-Type'] = 'application/json'
            if origin:
                headers['Origin'] = f'http://127.0.0.1:{self.port}'
            payload = json.dumps(body).encode()
        else:
            payload = None
        if cookie:
            headers['Cookie'] = cookie
        request = urllib.request.Request(f'http://127.0.0.1:{self.port}{path}',
                                         headers=headers, data=payload)
        try:
            result = urllib.request.urlopen(request, timeout=2)
        except urllib.error.HTTPError as err:
            result = err
        with result:
            return result.status, json.loads(result.read()), result.headers

    def test_status_offline(self):
        with patch.object(shared.core, 'CONFIG', None):
            status, result, headers = self.call('/api/status')
            self.assertEqual(status, 200)
            self.assertFalse(result['configured'])
            self.assertTrue(result['cookieAuth'])
            self.assertEqual(headers['Cache-Control'], 'private, no-store, max-age=0')

    def test_anonymous_gate(self):
        with patch.object(shared.core, 'CONFIG', {'url': 'https://x.supabase.co', 'key': 'x'}):
            status, result, _ = self.call('/api/auth/session')
            self.assertEqual(status, 200)
            self.assertFalse(result['authenticated'])
            status, result, _ = self.call('/api/cloud/data')
            self.assertEqual(status, 401)

    def test_csrf_origin_required(self):
        status, result, _ = self.call('/api/auth/signup', {'name': 'Vale'}, origin=False)
        self.assertEqual(status, 403)
        self.assertIn('Origen', result['error'])

    def test_bad_signup_shows_field_error(self):
        status, result, _ = self.call('/api/auth/signup', {'name': '', 'email': '', 'password': ''})
        self.assertEqual(status, 400)
        self.assertIn('nombre', result['error'])

    def test_signup_confirm_message(self):
        with patch.object(shared.core, 'CONFIG', {'url': 'https://x.supabase.co', 'key': 'x'}), \
             patch.object(shared.core, 'supabase', return_value={'user': {'id': 'u'}}) as req:
            status, result, headers = self.call('/api/auth/signup',
                {'name': 'Valentin', 'email': 'v@e.co', 'password': '12345678'})
            self.assertEqual(status, 200)
            self.assertFalse(result['authenticated'])
            self.assertIn('confirmá', result['message'])
            self.assertNotIn('Set-Cookie', headers)
            self.assertEqual(req.call_args.kwargs['data']['data']['full_name'], 'Valentin')

    def test_login_http_only_tokens_and_data(self):
        user = {'id': 'user-one', 'email': 'a@test.com', 'user_metadata': {'full_name': 'Alicia'}}
        def mock_supabase(path, **kw):
            if path.startswith('/auth/v1/token?grant_type=password'):
                return {'access_token': 'token.jwt.fake', 'refresh_token': 'refreshtoken',
                        'expires_in': 3600, 'user': user}
            if path == '/auth/v1/user' and kw.get('token') == 'token.jwt.fake':
                return user
            raise AssertionError('Unexpected API call ' + path)
        with patch.object(shared.core, 'CONFIG', {'url': 'https://x.supabase.co', 'key': 'x'}), \
             patch.object(shared.core, 'supabase', side_effect=mock_supabase):
            status, payload, head = self.call('/api/auth/login', {'email': 'a@test.com', 'password': 'abcdefgh'})
            self.assertEqual(status, 200)
            cookies = head.get_all('Set-Cookie')
            self.assertEqual(len(cookies), 2)
            self.assertTrue(all('HttpOnly' in x and 'SameSite=Lax' in x for x in cookies))
            self.assertTrue(any('perci_at=' in x for x in cookies))
            self.assertTrue(any('perci_rt=' in x for x in cookies))
            cookie_header = 'perci_at=token.jwt.fake; perci_rt=refreshtoken'
            status, payload, _ = self.call('/api/auth/session', cookie=cookie_header)
            self.assertTrue(payload['authenticated'])
            self.assertEqual(payload['user']['name'], 'Alicia')

    def test_refresh_rotates_cookies(self):
        user = {'id': 'user-one', 'email': 'a@test.com'}
        def mock_supabase(path, **kw):
            if path == '/auth/v1/user' and kw.get('token') == 'oldtoken':
                raise shared.core.ApiError('expired', 401)
            if path.startswith('/auth/v1/token?grant_type=refresh_token'):
                return {'access_token': 'newtoken', 'refresh_token': 'newrefresh', 'expires_in': 3600}
            if path == '/auth/v1/user' and kw.get('token') == 'newtoken':
                return user
            raise AssertionError(path)
        with patch.object(shared.core, 'CONFIG', {'url': 'https://x.supabase.co', 'key': 'x'}), \
             patch.object(shared.core, 'supabase', side_effect=mock_supabase):
            status, data, head = self.call('/api/auth/session', cookie='perci_at=oldtoken; perci_rt=oldrefresh')
            self.assertTrue(data['authenticated'])
            self.assertEqual(len(head.get_all('Set-Cookie')), 2)

    def test_private_cloud_requires_auth(self):
        with patch.object(shared.core, 'CONFIG', {'url': 'https://x.supabase.co', 'key': 'x'}):
            status, data, _ = self.call('/api/cloud/sync', {'snapshot': {'routines': [], 'records': [], 'habits': []}})
            self.assertEqual(status, 401)

    def test_secure_cookie_attribute_in_production(self):
        with patch.dict('os.environ', {'VERCEL': '1'}):
            self.assertIn('Secure', shared.cookie_value('perci_at', 'abc', secure=True))
            self.assertIn('HttpOnly', shared.cookie_value('perci_at', 'abc', secure=True))


if __name__ == '__main__':
    unittest.main()
