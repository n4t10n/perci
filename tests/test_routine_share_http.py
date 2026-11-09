"""Percí Share HTTP contract tests. All API and Supabase traffic is mocked."""
import http.server
import json
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
from api import shared

USER_A = '11111111-1111-4111-8111-111111111111'
USER_B = '22222222-2222-4222-8222-222222222222'
CODE = 'PERC-AbcdEfgh0123_-Zq'
ROUTINE = {'name': 'Piernas', 'exercises': [{'name': 'Sentadilla', 'sets': 3, 'reps': 10}]}


class Handler(shared.ApiHandler):
    pass


class TestRoutineShareHTTP(unittest.TestCase):
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

    def post(self, data, *, origin=None):
        raw = json.dumps(data).encode()
        req = urllib.request.Request(self.url + '/api/routine/share', data=raw,
                                     headers={'Origin': origin or self.url, 'Content-Type':'application/json'})
        try:
            resp = urllib.request.urlopen(req, timeout=3)
        except urllib.error.HTTPError as exc:
            resp = exc
        with resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))

    def test_anonymous_cannot_create(self):
        with patch.object(Handler,'authenticated',return_value=(None,None,())), \
             patch.object(shared.core,'supabase') as remote:
            status,_=self.post({'action':'create','sourceId':'abc','routine':ROUTINE})
            self.assertEqual(status,401)
            remote.assert_not_called()

    def test_authenticated_create_sanitizes_payload(self):
        with patch.object(Handler,'authenticated',return_value=('jwt-A',{'id':USER_A},())), \
             patch.object(shared.core,'supabase',return_value=CODE) as remote:
            status,body=self.post({'action':'create','sourceId':'abc','user_id':USER_B,
                                   'routine':{**ROUTINE,'user_id':USER_B,'records':[{'weight':200}]}})
            self.assertEqual(status,200)
            self.assertEqual(body['code'],CODE)
            self.assertEqual(remote.call_args.kwargs['token'],'jwt-A')
            self.assertNotIn('user_id',remote.call_args.kwargs['data']['p_payload'])
            self.assertNotIn('records',remote.call_args.kwargs['data']['p_payload'])

    def test_cannot_override_owner_by_body_in_lookup(self):
        with patch.object(Handler,'authenticated',return_value=('jwt-B',{'id':USER_B},())), \
             patch.object(shared.core,'supabase',return_value=ROUTINE) as remote:
            status,body=self.post({'action':'lookup','user_id':USER_A,'code':CODE})
            self.assertEqual(status,200)
            self.assertEqual(body['routine']['name'],'Piernas')
            self.assertEqual(remote.call_args.kwargs['token'],'jwt-B')
            self.assertEqual(remote.call_args.kwargs['data'],{'p_code':CODE})

    def test_invalid_code_returns_400_without_remote_call(self):
        with patch.object(Handler,'authenticated',return_value=('jwt-B',{'id':USER_B},())), \
             patch.object(shared.core,'supabase') as remote:
            status,_=self.post({'action':'lookup','code':'anything'})
            self.assertEqual(status,400)
            remote.assert_not_called()

    def test_unknown_code_returns_404(self):
        with patch.object(Handler,'authenticated',return_value=('jwt-B',{'id':USER_B},())), \
             patch.object(shared.core,'supabase',return_value=None):
            status,_=self.post({'action':'lookup','code':CODE})
            self.assertEqual(status,404)

    def test_external_origin_rejected(self):
        with patch.object(Handler,'authenticated',return_value=('jwt-B',{'id':USER_B},())), \
             patch.object(shared.core,'supabase') as remote:
            status,_=self.post({'action':'create','sourceId':'abc','routine':ROUTINE},
                               origin='https://attacker.example')
            self.assertEqual(status,403)
            remote.assert_not_called()


if __name__ == '__main__': unittest.main()
