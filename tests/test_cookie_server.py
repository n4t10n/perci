"""Offline contract tests. No real Supabase credentials or network needed."""
import http.client
import importlib.util
import json
from pathlib import Path
import threading
import time
import unittest
from unittest.mock import patch
from http.server import HTTPServer

FILE=Path(__file__).resolve().parents[1] / 'server/perci_server.py'
spec=importlib.util.spec_from_file_location('perci_server',FILE)
server=importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.web=HTTPServer(('127.0.0.1',0),server.Handler)
        cls.port=cls.web.server_port
        cls.old_port=server.PORT
        server.PORT=cls.port
        cls.thread=threading.Thread(target=cls.web.serve_forever,daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.web.shutdown();cls.thread.join(timeout=5);cls.web.server_close();server.PORT=cls.old_port

    def get(self,path,cookie=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=5)
        headers={'Cookie':cookie} if cookie else {}
        conn.request('GET',path,headers=headers)
        response=conn.getresponse();raw=response.read()
        result=(response.status,dict(response.getheaders()),raw)
        conn.close();return result

    def post(self,path,body,*,origin=True,cookie=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=5)
        headers={'Content-Type':'application/json'}
        if origin:headers['Origin']=f'http://127.0.0.1:{self.port}'
        if cookie:headers['Cookie']=cookie
        conn.request('POST',path,body=json.dumps(body),headers=headers)
        response=conn.getresponse();raw=response.read()
        result=(response.status,dict(response.getheaders()),json.loads(raw))
        conn.close();return result

    def test_01_health_no_credentials(self):
        with patch.object(server,'CONFIG',None):
            status,heads,body=self.get('/api/auth/session')
        self.assertEqual(status,200)
        self.assertFalse(json.loads(body)['authenticated'])
        self.assertIn('no-store',heads['Cache-Control'])

    def test_02_protect_internal_files(self):
        for path in ('/.env','/.env.example','/server/perci_server.py','/supabase/migrations/202611050001_perci_core.sql','/docs/04-Roadmap.md','/.perci-private/sessions.json'):
            self.assertEqual(self.get(path)[0],404,path)

    def test_03_same_origin_required(self):
        status,_,data=self.post('/api/auth/login',{'email':'x@y.com','password':'abcdefgh'},origin=False)
        self.assertEqual(status,403)
        self.assertIn('Origen',data['error'])

    def test_04_cookie_login_and_session(self):
        fake={'url':'https://project.supabase.co','key':'sb_publishable_testkey'}
        def get_fake(path,**kw):
            if path.startswith('/auth/v1/token?grant_type=password'):
                return {'access_token':'fake-access','refresh_token':'fake-refresh','expires_in':3600,'user':{'id':'d7396485-4017-4caa-a4be-2e8f73681e6c','email':'a@b.co'}}
            if path=='/auth/v1/user':
                return {'id':'d7396485-4017-4caa-a4be-2e8f73681e6c','email':'a@b.co'}
            if path=='/auth/v1/logout':return None
            raise AssertionError(path)
        with patch.object(server,'CONFIG',fake),patch.object(server,'supabase',side_effect=get_fake):
            status,heads,body=self.post('/api/auth/login',{'email':'a@b.co','password':'secure123'})
            self.assertEqual(status,200)
            cookie=heads['Set-Cookie'];self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Lax',cookie)
            self.assertNotIn('fake-access',cookie);self.assertNotIn('fake-refresh',cookie)
            token=cookie.split(';',1)[0]
            st,hd,res=self.get('/api/auth/session',token)
            self.assertEqual(st,200);self.assertEqual(json.loads(res)['user']['email'],'a@b.co')
            st,hd,res=self.post('/api/auth/logout',{},cookie=token)
            self.assertEqual(st,200);self.assertIn('Max-Age=0',hd['Set-Cookie'])
        server.SESSIONS.clear();server.save_sessions(server.SESSIONS)

    def test_05_demo_exclusion_from_cloud(self):
        snapshot={'demo':True,'routines':[{'id':'r1','name':'Demo','exercises':[]},{'id':'real1','name':'Full Body','exercises':[{'name':'Press','sets':3,'reps':10}]}], 'records':[{'id':'s1','type':'walk','name':'Caminata','date':'2026-11-01','minutes':20}], 'habits':[{'id':'h1','name':'Hidratarme','days':[1]}], 'checks':{}, 'draft':None}
        uploads=[]
        def batch(table,rows,token,conflict):
            uploads.append((table,rows))
            return rows
        def select(table,token,user,columns):
            if table=='perci_routines':return [{'id':'3d238168-55a9-46b1-a3bf-ef7a984d7df0','client_id':'perci-v04:routine:real1'}]
            return []
        with patch.object(server,'batch_upsert',side_effect=batch),patch.object(server,'select_rows',side_effect=select):
            result=server.upload_data(snapshot,'test_access','d7396485-4017-4caa-a4be-2e8f73681e6c')
        self.assertEqual(result['routines'],1)
        self.assertEqual(result['records'],0)
        self.assertEqual(result['habits'],0)
        self.assertEqual(next(rows for table,rows in uploads if table=='perci_routines')[0]['client_id'],'perci-v04:routine:real1')

if __name__=='__main__':unittest.main()

# Test adicional escrito fuera de la clase original para comprobar metadatos del registro.
class RegistrationTests(unittest.TestCase):
    post = ApiTests.post
    setUpClass = classmethod(ApiTests.setUpClass.__func__)
    tearDownClass = classmethod(ApiTests.tearDownClass.__func__)
    def test_06_signup_name_metadata(self):
        calls=[]
        def fake(path,**kw):
            calls.append((path,kw))
            return {'user':{'id':'d7396485-4017-4caa-a4be-2e8f73681e6c','email':'a@b.co','user_metadata':{'full_name':'Valentín'}}}
        with patch.object(server,'CONFIG',{'url':'https://project.supabase.co','key':'sb_publishable_test'}),patch.object(server,'supabase',side_effect=fake):
            status,headers,body=self.post('/api/auth/signup',{'name':'Valentín','email':'a@b.co','password':'password123'})
        self.assertEqual(status,200)
        self.assertFalse(body['authenticated'])
        self.assertEqual(calls[0][1]['data']['data']['full_name'],'Valentín')

    def test_07_signup_fields_independently_validated(self):
        for body,part in [({'name':'X','email':'a@b.co','password':'password123'},'nombre'),
                          ({'name':'Valentín','email':'sin-arroba','password':'password123'},'correo'),
                          ({'name':'Valentín','email':'a@b.co','password':'corta'},'contraseña')]:
            status,_,data=self.post('/api/auth/signup',body)
            self.assertEqual(status,400)
            self.assertIn(part,data['error'])
