"""v1.3: borrados de historial en Supabase con el JWT del usuario, sin service role."""
import unittest
from unittest.mock import patch
import json
from tests.test_vercel_api import Handler, TestVercelAPI
from server import perci_server as core
from api import shared

USER='123e4567-e89b-12d3-a456-426614174000'

class TestDeleteRecords(unittest.TestCase):
    def test_reject_bad_ids(self):
        for ids in (None, 's1', ['abc?def'], ['x']*101):
            with self.assertRaises(core.ApiError):
                core.delete_activity_records(ids,'token',USER)

    def test_delete_scopes_to_owner_and_client_id(self):
        with patch.object(core,'postgres',return_value=None) as req:
            out=core.delete_activity_records(['rec-one','rec-one','rec-two'],'jwt',USER)
        self.assertEqual(out,{'processed':2})
        self.assertEqual(req.call_count,2)
        args,kw=req.call_args_list[0]
        self.assertEqual(args,('perci_activity_records','jwt'))
        self.assertEqual(kw['method'],'DELETE')
        self.assertEqual(kw['filters']['user_id'],'eq.'+USER)
        self.assertEqual(kw['filters']['client_id'],'eq.perci-v04:record:rec-one')

    def test_anonymous_delete_denied_at_api(self):
        """Use test harness without creating real Supabase users."""
        import http.server,threading,urllib.request,urllib.error
        srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        thr=threading.Thread(target=srv.serve_forever,daemon=True);thr.start()
        try:
            data=json.dumps({'records':['x1']}).encode()
            rq=urllib.request.Request(f'http://127.0.0.1:{srv.server_address[1]}/api/cloud/delete',
                data=data,headers={'Content-Type':'application/json','Origin':f'http://127.0.0.1:{srv.server_address[1]}'})
            with patch.object(shared.core,'CONFIG',{'url':'https://example.supabase.co','key':'x'}):
                with self.assertRaises(urllib.error.HTTPError) as ctx: urllib.request.urlopen(rq)
            self.assertEqual(ctx.exception.code,401)
        finally:
            srv.shutdown();srv.server_close();thr.join(timeout=2)

if __name__=='__main__':unittest.main()
