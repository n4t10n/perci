#!/usr/bin/env python3
"""Percí development server: first-party HttpOnly cookie sessions + Supabase Auth/RLS REST.
No third-party Python dependencies. Bind loopback only, never publish this server to Internet.
"""
import hashlib
import http.cookies
import http.server
import json
import math
import os
from pathlib import Path
import re
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
HOST = '127.0.0.1'
PORT = int(os.environ.get('PERCI_PORT', '5173'))
COOKIE = 'perci_sid'
MAX_BODY = 1_000_000
SESSION_TTL = 30 * 86400
PRIVATE_DIR = ROOT / '.perci-private'
SESSIONS_FILE = PRIVATE_DIR / 'sessions.json'
ALLOWED_GET_PREFIXES = ('/assets/', '/src/')
ALLOWED_ROOT = {'/', '/index.html', '/manifest.webmanifest', '/sw.js'}
TYPES = {'gym', 'walk', 'run', 'cycle', 'sport', 'other'}

# Canonical public Percí login for signup confirmation. Avoid Vercel preview URLs.
# This URL must be allowed under Supabase Auth > URL Configuration.
CONFIRMATION_LOGIN_URL = 'https://perci-gamma.vercel.app/?auth=verified'

def signup_auth_endpoint():
    return '/auth/v1/signup?' + urllib.parse.urlencode({'redirect_to': CONFIRMATION_LOGIN_URL})


def read_env():
    values = {}
    env_path = ROOT / '.env'
    if env_path.exists():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"\'')
    for key in ('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'):
        if key in os.environ:
            values[key] = os.environ[key]
    url = values.get('SUPABASE_URL', '').rstrip('/')
    key = values.get('SUPABASE_PUBLISHABLE_KEY', '')
    parsed = urllib.parse.urlparse(url)
    if not url or not key:
        return None
    if (parsed.scheme != 'https' or not re.fullmatch(r'[a-z0-9-]+\.supabase\.co', parsed.hostname or '') or
        parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        raise ValueError('SUPABASE_URL debe tener formato https://proyecto.supabase.co')
    if key.startswith(('sb_secret_', 'service_role')):
        raise ValueError('Nunca uses una clave secret/service_role con Percí.')
    if not (key.startswith('sb_publishable_') or (key.count('.') == 2 and len(key) > 90)):
        raise ValueError('Usá una clave pública Supabase publishable o anon.')
    return {'url': url, 'key': key}

CONFIG = read_env()


def save_sessions(sessions):
    PRIVATE_DIR.mkdir(mode=0o700, exist_ok=True)
    os.chmod(PRIVATE_DIR, 0o700)
    temp = PRIVATE_DIR / '.sessions.tmp'
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(sessions, f)
    os.chmod(temp, 0o600)
    os.replace(temp, SESSIONS_FILE)


def load_sessions():
    try:
        if SESSIONS_FILE.exists():
            os.chmod(SESSIONS_FILE, 0o600)
            return json.loads(SESSIONS_FILE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        pass
    return {}

SESSIONS = load_sessions()


def sid_key(sid):
    return hashlib.sha256(sid.encode('utf-8')).hexdigest()


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def supabase(path, *, method='GET', data=None, token=None, prefer=None):
    if not CONFIG:
        raise ApiError('La cuenta todavía no está disponible. Configurá Supabase en el servidor.', 503)
    if not path.startswith('/') or '://' in path:
        raise ApiError('Ruta de API inválida.')
    raw = None if data is None else json.dumps(data).encode('utf-8')
    headers = {'apikey': CONFIG['key'], 'Accept': 'application/json', 'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if prefer:
        headers['Prefer'] = prefer
    req = urllib.request.Request(CONFIG['url'] + path, data=raw, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=14) as response:
            payload = response.read(1_000_000)
            return json.loads(payload) if payload else None
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read(4096).decode('utf-8'))
            msg = detail.get('msg') or detail.get('message') or detail.get('error_description') or 'No se pudo completar la operación.'
        except Exception:
            msg = 'Supabase rechazó la operación.'
        raise ApiError(str(msg), e.code)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise ApiError('No hay conexión con el servidor de la cuenta. Tus datos locales siguen disponibles.', 503) from exc


def auth_tokens(data):
    if not isinstance(data, dict) or not data.get('access_token') or not data.get('refresh_token'):
        raise ApiError('La cuenta requiere confirmar el correo antes de iniciar sesión.', 403)
    return {'access': data['access_token'], 'refresh': data['refresh_token'],
            'expires_at': time.time() + int(data.get('expires_in') or 3600),
            'valid_until': time.time() + SESSION_TTL}


def postgres(table, token, *, method='GET', filters=None, rows=None, conflict=None):
    if table not in {'perci_profiles', 'perci_routines', 'perci_routine_exercises',
                     'perci_activity_records', 'perci_workout_sets', 'perci_habits', 'perci_habit_checks'}:
        raise ApiError('Tabla no autorizada.')
    q = urllib.parse.urlencode(filters or {})
    if conflict:
        q = (q + '&' if q else '') + 'on_conflict=' + urllib.parse.quote(conflict, safe=',')
    url = '/rest/v1/' + table + ('?' + q if q else '')
    return supabase(url, method=method, data=rows, token=token,
                    prefer=('resolution=merge-duplicates,return=representation' if method == 'POST' else None))


def select_rows(table, token, user, columns='*'):
    return postgres(table, token, filters={'select': columns, 'user_id': 'eq.' + user, 'limit': '1000'}) or []


def to_client(kind, legacy):
    value = str(legacy)
    return f'perci-v04:{kind}:{value}'


def verify_snapshot(snapshot):
    if not isinstance(snapshot, dict) or not all(isinstance(snapshot.get(k), list) for k in ('routines','records','habits')):
        raise ApiError('Los datos locales no tienen el formato esperado.')
    if any(len(snapshot[k]) > 300 for k in ('routines','records','habits')):
        raise ApiError('Demasiados registros para esta versión de prueba.')
    # Validate element shapes before reading fields. Invalid JSON must return 400,
    # never leak into a generic server-side 500 or partially write a snapshot.
    if any(not isinstance(item, dict) for kind in ('routines','records','habits') for item in snapshot[kind]):
        raise ApiError('Los registros deben ser objetos válidos.', 400)
    if any(not isinstance(item, dict) for routine in snapshot['routines']
           for item in routine.get('exercises', []) if isinstance(routine.get('exercises'), list)):
        raise ApiError('Los ejercicios deben ser objetos válidos.', 400)
    if not isinstance(snapshot.get('checks', {}), dict):
        raise ApiError('Los hábitos marcados tienen un formato inválido.', 400)
    for r in snapshot['routines']:
        if not isinstance(r.get('id'),str) or not isinstance(r.get('name'),str) or not r['name'].strip() or not 1 <= len(r['name']) <= 80:
            raise ApiError('Rutina con nombre inválido.')
        if not isinstance(r.get('exercises'),list) or len(r['exercises']) > 100:
            raise ApiError('Rutina sin ejercicios válidos.')
        for e in r['exercises']:
            if not isinstance(e.get('name'),str) or not e['name'].strip() or not 1 <= len(e['name']) <= 80 or not 1<=int(e.get('sets',0))<=15 or not 1<=int(e.get('reps',0))<=100:
                raise ApiError('Ejercicio con campos inválidos.')
    for rec in snapshot['records']:
        if rec.get('type') not in TYPES or not isinstance(rec.get('name'),str) or not rec['name'].strip() or not 1<=int(rec.get('minutes',0))<=1440 or not re.fullmatch(r'\d{4}-\d\d-\d\d',str(rec.get('date',''))):
            raise ApiError('Actividad inválida.')
        details=rec.get('setDetails',[])
        if not isinstance(details,list) or len(details)>600 or (details and rec.get('type')!='gym'):
            raise ApiError('Las series del entrenamiento son inválidas.')
        seen=set()
        for entry in details:
            if not isinstance(entry,dict):
                raise ApiError('Serie de entrenamiento inválida.')
            position=entry.get('exercisePosition');number=entry.get('setNumber')
            reps=entry.get('reps');weight=entry.get('weight');name=entry.get('exerciseName')
            if (not isinstance(position,int) or position<0 or position>99 or
                not isinstance(number,int) or not 1<=number<=15 or
                not isinstance(reps,int) or not 0<=reps<=100 or
                not isinstance(weight,(int,float)) or isinstance(weight,bool) or
                not math.isfinite(weight) or not 0<=weight<=99999 or
                not isinstance(name,str) or not 1<=len(name.strip())<=80 or
                (position,number) in seen):
                raise ApiError('Serie de entrenamiento inválida.')
            seen.add((position,number))
    for h in snapshot['habits']:
        if not isinstance(h.get('name'),str) or not h['name'].strip() or not isinstance(h.get('days'),list) or not h['days'] or any(not isinstance(d,int) or d<0 or d>6 for d in h['days']):
            raise ApiError('Hábito inválido.')


def batch_upsert(table, rows, token, conflict):
    if not rows:
        return []
    return postgres(table, token, method='POST', rows=rows, conflict=conflict) or []


def delete_activity_records(records, token, user):
    """Borrado idempotente por propietario+client_id con RLS de Supabase.
    Incluye la eliminación en cascada de las series ya registradas.
    """
    if (not isinstance(records,list) or len(records)>100 or
        any(not isinstance(x,str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',x) for x in records)):
        raise ApiError('Identificadores de registro inválidos.',400)
    for item in dict.fromkeys(records):
        postgres('perci_activity_records',token,method='DELETE',filters={
            'user_id':'eq.'+user, 'client_id':'eq.'+to_client('record',item)})
    return {'processed':len(set(records))}



def delete_cloud_entities(deletions, token, user):
    """Delete only explicitly named own entities using the user's JWT and RLS.

    Idempotent: an already-deleted ID succeeds. Postgres cascades exercise/check
    children, and preserves historical activity when deleting a routine.
    """
    if not isinstance(deletions, dict) or not deletions or any(
        key not in ('records', 'routines', 'habits') for key in deletions):
        raise ApiError('Solicitud de eliminación inválida.', 400)
    tables = {'records': ('perci_activity_records', 'record'),
              'routines': ('perci_routines', 'routine'),
              'habits': ('perci_habits', 'habit')}
    validated = {}
    for kind, ids in deletions.items():
        if not isinstance(ids, list) or len(ids) > 100 or any(
                not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', value)
                for value in ids):
            raise ApiError('Identificadores de eliminación inválidos.', 400)
        validated[kind] = list(dict.fromkeys(ids))
    if sum(map(len, validated.values())) > 100:
        raise ApiError('Demasiadas eliminaciones en una solicitud.', 400)
    for kind, ids in validated.items():
        table, prefix = tables[kind]
        for item in ids:
            postgres(table, token, method='DELETE', filters={
                'user_id': 'eq.' + user,
                'client_id': 'eq.' + to_client(prefix, item)})
    return {'processed': {kind: len(items) for kind, items in validated.items()}}


def assert_remote_unchanged(expected, current):
    """Conservative stale-snapshot guard; not a transactional compare-and-swap."""
    if not isinstance(expected, dict) or any(
        not isinstance(expected.get(k), list) for k in ('routines', 'records', 'habits')
    ) or not isinstance(expected.get('checks'), dict):
        raise ApiError('Versión remota inválida. Actualizá la aplicación.', 400)
    for kind in ('routines', 'records', 'habits'):
        if any(not isinstance(item, dict) or not isinstance(item.get('id'), str)
               for item in expected[kind]):
            raise ApiError('Versión remota inválida. Actualizá la aplicación.', 400)
        old = sorted(expected[kind], key=lambda item: item.get('id', ''))
        live = sorted(current[kind], key=lambda item: item.get('id', ''))
        if old != live:
            raise ApiError('Otro dispositivo actualizó tu cuenta. Vamos a comparar los cambios.', 409)
    if expected['checks'] != current['checks']:
        raise ApiError('Otro dispositivo actualizó tus hábitos. Vamos a comparar los cambios.', 409)


def upload_data(snapshot, token, user, expected=None):
    verify_snapshot(snapshot)
    # JWT de usuario + lectura fresca de Supabase antes del primer upsert.
    if expected is not None:
        assert_remote_unchanged(expected, download_data(token, user))
    # Nunca subir actividad ni hábitos DEMO por accidente. La rutina personalizada sí.
    demo = snapshot.get('demo') is True
    routines = [r for r in snapshot['routines'] if r.get('id') != 'r1'] if demo else snapshot['routines']
    records = [r for r in snapshot['records'] if r.get('id') not in ('s1','s2','s3')] if demo else snapshot['records']
    habits = [h for h in snapshot['habits'] if h.get('id') not in ('h1','h2')] if demo else snapshot['habits']
    if snapshot.get('draft'):
        raise ApiError('Finalizá el entrenamiento activo antes de vincular datos a tu cuenta.')
    batch_upsert('perci_profiles', [{'user_id': user, 'theme': snapshot.get('theme', 'dark') if snapshot.get('theme') in ('dark','light','system') else 'dark', 'focus': snapshot.get('focus','both') if snapshot.get('focus') in ('gym','others','both') else 'both', 'onboarding_done': True}], token, 'user_id')
    batch_upsert('perci_routines', [{'user_id':user,'client_id':to_client('routine',r['id']),'name':r['name'].strip()} for r in routines], token, 'user_id,client_id')
    remote_routines = select_rows('perci_routines', token, user, 'id,client_id')
    routine_ids={x['client_id']:x['id'] for x in remote_routines}
    ex=[]
    for r in routines:
        routine_id = routine_ids.get(to_client('routine',r['id']))
        if not routine_id:
            raise ApiError('No se pudo verificar la rutina remota.', 502)
        for ix,e in enumerate(r['exercises']):
            ex.append({'user_id':user,'routine_id':routine_id,'client_id':to_client('exercise',f"{r['id']}:{ix}"),'position':ix,'name':e['name'].strip(),'target_sets':int(e['sets']),'target_reps':int(e['reps'])})
    batch_upsert('perci_routine_exercises', ex, token, 'user_id,client_id')
    batch_upsert('perci_activity_records', [{'user_id':user,'client_id':to_client('record',r['id']), 'activity_type':r['type'],'name':r['name'][:80],'activity_date':r['date'],'minutes':int(r['minutes']), 'distance_km':r.get('distance'), 'sets_done':r.get('setsDone'),'volume_kg':r.get('volume'),'note':str(r.get('note',''))[:400]} for r in records], token, 'user_id,client_id')
    # Subir series completadas, idempotentes por registro, ejercicio y número de serie.
    if any(r.get('setDetails') for r in records):
        remote_records=select_rows('perci_activity_records',token,user,'id,client_id')
        record_ids={x['client_id']:x['id'] for x in remote_records}
        set_rows=[]
        for rec in records:
            rid=record_ids.get(to_client('record',rec['id']))
            if rec.get('setDetails') and not rid:
                raise ApiError('No se pudo verificar el registro remoto.',502)
            for item in rec.get('setDetails',[]):
                set_rows.append({'user_id':user,'record_id':rid,
                    'exercise_position':item['exercisePosition'],'exercise_name':item['exerciseName'].strip(),
                    'set_number':item['setNumber'],'reps':item['reps'],
                    'weight_kg':float(item['weight']),'completed':bool(item.get('completed',True))})
        batch_upsert('perci_workout_sets',set_rows,token,'record_id,exercise_position,set_number')
    batch_upsert('perci_habits', [{'user_id':user,'client_id':to_client('habit',h['id']), 'name':h['name'][:70], 'days':h['days'],'paused':bool(h.get('paused'))} for h in habits],token, 'user_id,client_id')
    remote_habits=select_rows('perci_habits',token,user,'id,client_id')
    map_habits={r['client_id']:r['id'] for r in remote_habits}
    checks=[]
    for k,done in (snapshot.get('checks') or {}).items():
        if not done or ':' not in k:
            continue
        legacy,dt=k.rsplit(':',1)
        if legacy not in {h['id'] for h in habits} or not re.fullmatch(r'\d{4}-\d\d-\d\d',dt):
            continue
        checks.append({'user_id':user,'habit_id':map_habits[to_client('habit',legacy)],'check_date':dt,'completed':True})
    batch_upsert('perci_habit_checks',checks,token,'user_id,habit_id,check_date')
    # Confirmar al menos que la base tenga las rutinas recién enviadas.
    if any(to_client('routine',r['id']) not in routine_ids for r in routines):
        raise ApiError('No fue posible confirmar el respaldo de las rutinas.',502)
    return {'routines':len(routines),'records':len(records),'habits':len(habits),'demoExcluded':demo}


def parse_legacy(client_id,kind):
    prefix = f'perci-v04:{kind}:'
    return client_id[len(prefix):] if isinstance(client_id,str) and client_id.startswith(prefix) else None


def download_data(token,user):
    rt=select_rows('perci_routines',token,user,'id,client_id,name')
    ex=select_rows('perci_routine_exercises',token,user,'routine_id,position,name,target_sets,target_reps')
    ac=select_rows('perci_activity_records',token,user,'id,client_id,activity_type,name,activity_date,minutes,distance_km,sets_done,volume_kg,note')
    completed_sets=select_rows('perci_workout_sets',token,user,'record_id,exercise_position,exercise_name,set_number,reps,weight_kg,completed')
    sets_by_record={}
    for row in completed_sets:
        sets_by_record.setdefault(row['record_id'],[]).append(row)
    ha=select_rows('perci_habits',token,user,'id,client_id,name,days,paused')
    ck=select_rows('perci_habit_checks',token,user,'habit_id,check_date,completed')
    groups={}
    for e in ex:
        groups.setdefault(e['routine_id'],[]).append(e)
    routines=[]
    for r in rt:
        rid=parse_legacy(r['client_id'],'routine')
        if rid:
            routines.append({'id':rid,'name':r['name'],'exercises':[{'name':e['name'],'sets':e['target_sets'],'reps':e['target_reps']} for e in sorted(groups.get(r['id'],[]),key=lambda x:x['position'])]})
    records=[]
    for r in ac:
        rid=parse_legacy(r['client_id'],'record')
        if rid:
            obj={'id':rid,'type':r['activity_type'],'name':r['name'],'date':r['activity_date'],'minutes':r['minutes'],'note':r.get('note') or ''}
            for api,local in [('distance_km','distance'),('sets_done','setsDone'),('volume_kg','volume')]:
                if r.get(api) is not None:obj[local]=float(r[api]) if api!='sets_done' else r[api]
            details=sets_by_record.get(r['id'],[])
            if details:
                obj['setDetails']=[{'exercisePosition':x['exercise_position'],
                    'exerciseName':x['exercise_name'],'setNumber':x['set_number'],
                    'reps':x['reps'],'weight':float(x['weight_kg']),'completed':bool(x['completed'])}
                    for x in sorted(details,key=lambda y:(y['exercise_position'],y['set_number']))]
            records.append(obj)
    habits=[]
    habit_ids={}
    for h in ha:
        hid=parse_legacy(h['client_id'],'habit')
        if hid:
            habits.append({'id':hid,'name':h['name'],'days':h['days'],'paused':h['paused']})
            habit_ids[h['id']]=hid
    checks={f"{habit_ids[c['habit_id']]}:{c['check_date']}":True for c in ck if c.get('completed') and c['habit_id'] in habit_ids}
    return {'routines':routines,'records':records,'habits':habits,'checks':checks}



def safe_user(user):
    if not isinstance(user, dict) or not user.get('id'):
        return None
    meta = user.get('user_metadata') or {}
    name = meta.get('full_name') or meta.get('name') or ''
    return {'id': user['id'], 'email': user.get('email',''),
            'name': name.strip()[:70] if isinstance(name,str) else ''}

class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = 'PerciDev/0.9'
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)

    def log_message(self,fmt,*args):
        # No registrar querystrings o credenciales; ruta solamente.
        print('%s %s' % (self.address_string(), fmt % args))

    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','same-origin')
        self.send_header('X-Frame-Options','DENY')
        super().end_headers()

    def send_json(self,payload,status=200,cookie=None):
        raw=json.dumps(payload,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(raw)))
        self.send_header('Cache-Control','no-store, private')
        if cookie:self.send_header('Set-Cookie',cookie)
        self.end_headers()
        self.wfile.write(raw)

    def sid(self):
        parsed = http.cookies.SimpleCookie()
        try: parsed.load(self.headers.get('Cookie',''))
        except http.cookies.CookieError: return None
        item=parsed.get(COOKIE)
        value=item.value if item else None
        return value if value and re.fullmatch('[a-zA-Z0-9_-]{40,100}',value) else None

    def current_session(self):
        sid=self.sid()
        if not sid or not CONFIG:return None,None
        item=SESSIONS.get(sid_key(sid))
        if not item:return None,None
        if time.time()>item.get('valid_until',0):
            SESSIONS.pop(sid_key(sid),None);save_sessions(SESSIONS)
            return None,None
        if time.time()>item.get('expires_at',0)-90:
            try:
                result=supabase('/auth/v1/token?grant_type=refresh_token',method='POST',data={'refresh_token':item['refresh']})
                item.update(auth_tokens(result));save_sessions(SESSIONS)
            except ApiError as e:
                if e.status in (400,401,403):
                    SESSIONS.pop(sid_key(sid),None);save_sessions(SESSIONS)
                    return None,None
                raise
        user=supabase('/auth/v1/user',token=item['access'])
        if not isinstance(user,dict) or not user.get('id'):
            raise ApiError('Volvé a iniciar sesión para continuar.',401)
        return item,user

    def cookie(self,sid=None):
        # Secure debe usarse bajo HTTPS en producción. localhost HTTP: cookie solo para desarrollo.
        secure = bool(os.environ.get('PERCI_HTTPS') == '1')
        pieces=[f'{COOKIE}={sid or ""}', 'Path=/', 'HttpOnly','SameSite=Lax',f'Max-Age={SESSION_TTL if sid else 0}']
        if secure:pieces.append('Secure')
        return '; '.join(pieces)

    def do_GET(self):
        if self.headers.get('Host','') not in (f'localhost:{PORT}',f'127.0.0.1:{PORT}'):
            self.send_error(403);return
        route=urllib.parse.urlsplit(self.path).path
        if route.startswith('/api/'):
            try:
                if route == '/api/status':
                    return self.send_json({'configured':bool(CONFIG),'cookieAuth':True})
                if route == '/api/auth/session':
                    item,user=self.current_session()
                    return self.send_json({'configured':bool(CONFIG),'authenticated':bool(user),'user':safe_user(user) if user else None})
                if route == '/api/cloud/data':
                    item,user=self.current_session()
                    if not user:raise ApiError('Iniciá sesión para recuperar tus datos.',401)
                    return self.send_json(download_data(item['access'],user['id']))
                raise ApiError('Ruta inexistente.',404)
            except ApiError as e:return self.send_json({'error':str(e)},e.status if 400<=e.status<=599 else 502)
            except Exception:return self.send_json({'error':'Error interno del servidor.'},500)
        if route not in ALLOWED_ROOT and not route.startswith(ALLOWED_GET_PREFIXES):
            self.send_error(404)
            return
        if '..' in urllib.parse.unquote(route).split('/'):
            self.send_error(404);return
        return super().do_GET()

    def do_POST(self):
        route=urllib.parse.urlsplit(self.path).path
        try:
            if self.headers.get('Host','') not in (f'localhost:{PORT}',f'127.0.0.1:{PORT}'):
                raise ApiError('Host no permitido.',403)
            origin=self.headers.get('Origin')
            expected=f'http://{self.headers.get("Host","")}'
            if not origin or origin != expected:
                raise ApiError('Origen de solicitud no permitido.',403)
            if self.headers.get('Content-Type','').split(';')[0].strip() != 'application/json':
                raise ApiError('Content-Type inválido.',415)
            size=int(self.headers.get('Content-Length','0'))
            if not 0 < size <= MAX_BODY:raise ApiError('Tamaño de solicitud inválido.',413)
            body=json.loads(self.rfile.read(size))
            if not isinstance(body,dict):raise ApiError('Solicitud inválida.')
            if route == '/api/auth/login':
                email=body.get('email',''); pwd=body.get('password','')
                if not isinstance(email,str) or len(email)>254 or not isinstance(pwd,str) or not 8<=len(pwd)<=200:
                    raise ApiError('Revisá tu correo y contraseña.')
                data=supabase('/auth/v1/token?grant_type=password',method='POST',data={'email':email.strip(),'password':pwd})
                sess=auth_tokens(data)
                sid=secrets.token_urlsafe(40)
                SESSIONS[sid_key(sid)]=sess;save_sessions(SESSIONS)
                return self.send_json({'authenticated':True,'user':safe_user(data['user'])},cookie=self.cookie(sid))
            if route == '/api/auth/signup':
                name=body.get('name',''); email=body.get('email',''); pwd=body.get('password','')
                if not isinstance(name,str) or not 2<=len(name.strip())<=70:
                    raise ApiError('Ingresá tu nombre (entre 2 y 70 caracteres).')
                if not isinstance(email,str) or len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email.strip()):
                    raise ApiError('Ingresá un correo electrónico válido.')
                if not isinstance(pwd,str) or not 8<=len(pwd)<=200:
                    raise ApiError('La contraseña debe tener al menos 8 caracteres.')
                # En GoTrue el campo data se almacena en user_metadata.
                data=supabase(signup_auth_endpoint(),method='POST',data={
                    'email':email.strip(),'password':pwd,'data':{'full_name':name.strip()}})
                if data.get('access_token'):
                    sess=auth_tokens(data);sid=secrets.token_urlsafe(40)
                    SESSIONS[sid_key(sid)]=sess;save_sessions(SESSIONS)
                    return self.send_json({'authenticated':True,'user':safe_user(data['user'])},cookie=self.cookie(sid))
                return self.send_json({'authenticated':False,'message':'Revisá tu correo y confirmá la cuenta para poder ingresar.'})
            if route == '/api/auth/logout':
                sid=self.sid()
                item=SESSIONS.pop(sid_key(sid),None) if sid else None
                save_sessions(SESSIONS)
                if item:
                    try:supabase('/auth/v1/logout',method='POST',data={},token=item['access'])
                    except ApiError:pass
                return self.send_json({'authenticated':False},cookie=self.cookie())
            if route == '/api/cloud/sync':
                item,user=self.current_session()
                if not user:raise ApiError('Iniciá sesión para guardar tus datos.',401)
                return self.send_json(upload_data(body.get('snapshot'),item['access'],user['id']))
            raise ApiError('Ruta inexistente.',404)
        except (ValueError,TypeError,json.JSONDecodeError):
            return self.send_json({'error':'Solicitud inválida.'},400)
        except ApiError as e:
            return self.send_json({'error':str(e)},e.status if 400<=e.status<=599 else 502)
        except Exception as e:
            print('Error interno:',type(e).__name__)
            return self.send_json({'error':'No se pudo completar la operación.'},500)


if __name__ == '__main__':
    if not CONFIG:print('Percí: modo local disponible. Agregá SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY a .env para activar cuentas.')
    print(f'Percí v0.9: http://localhost:{PORT} | Ctrl+C para detener')
    try:
        server=http.server.HTTPServer((HOST,PORT),Handler)
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor detenido.')
    except OSError as e:
        print('No se pudo iniciar:',e)
        sys.exit(1)
