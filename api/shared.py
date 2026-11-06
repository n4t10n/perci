"""Percí HTTPS/API endpoint shared by Vercel Python Functions.

No disk session store: access and refresh tokens are kept in separate host-only
HttpOnly cookies. Every private request verifies the token with Supabase Auth.
This is a DEVELOPMENT deployment pending real RLS and Safari end-to-end QA.
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from http.cookies import SimpleCookie, CookieError
from pathlib import Path
import json
import os
import re
import urllib.parse
from server import perci_server as core

SESSION_TTL = core.SESSION_TTL
MAX_BODY = core.MAX_BODY
ACCESS_COOKIE = 'perci_at'
REFRESH_COOKIE = 'perci_rt'
WEB_ROOT = Path(__file__).resolve().parents[1] / 'public'
ENDPOINTS = {
    '/api/status', '/api/auth/session', '/api/auth/login',
    '/api/auth/signup', '/api/auth/logout', '/api/cloud/data', '/api/cloud/sync'
}


def cookie_value(name, value='', *, expire=False, secure=True):
    ck = SimpleCookie()
    ck[name] = value
    ck[name]['path'] = '/'
    ck[name]['httponly'] = True
    ck[name]['samesite'] = 'Lax'
    if secure:
        ck[name]['secure'] = True
    ck[name]['max-age'] = 0 if expire else SESSION_TTL
    if expire:
        ck[name]['expires'] = 'Thu, 01 Jan 1970 00:00:00 GMT'
    # No Domain attribute means cookies are host-only.
    return ck[name].OutputString()


class ApiHandler(BaseHTTPRequestHandler):
    server_version = 'PerciAPI/1.0'
    endpoint = None

    def log_message(self, fmt, *args):
        # Do not log token, body, credential, or full query string.
        print('%s %s' % (self.address_string(), fmt % args))

    def secure(self):
        # Vercel always exposes HTTPS; local Python test server uses HTTP.
        return bool(os.environ.get('VERCEL') or os.environ.get('PERCI_HTTPS') == '1'
                    or self.headers.get('X-Forwarded-Proto', '').split(',')[0].strip() == 'https')

    def send_json(self, payload, status=200, *, cookies=()):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'private, no-store, max-age=0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('X-Frame-Options', 'DENY')
        for c in cookies:
            self.send_header('Set-Cookie', c)
        self.end_headers()
        self.wfile.write(body)

    def login_cookies(self, tokens):
        return (cookie_value(ACCESS_COOKIE, tokens['access_token'], secure=self.secure()),
                cookie_value(REFRESH_COOKIE, tokens['refresh_token'], secure=self.secure()))

    def logout_cookies(self):
        return (cookie_value(ACCESS_COOKIE, expire=True, secure=self.secure()),
                cookie_value(REFRESH_COOKIE, expire=True, secure=self.secure()))

    def get_tokens(self):
        try:
            cookies = SimpleCookie()
            cookies.load(self.headers.get('Cookie', ''))
            access = cookies.get(ACCESS_COOKIE)
            refresh = cookies.get(REFRESH_COOKIE)
            return (access.value if access else '', refresh.value if refresh else '')
        except CookieError:
            return '', ''

    def authenticated(self):
        if not core.CONFIG:
            return None, None, ()
        access, refresh = self.get_tokens()
        # Access can be expired while refresh remains valid.
        if access:
            try:
                user = core.supabase('/auth/v1/user', token=access)
                if isinstance(user, dict) and user.get('id'):
                    return access, user, ()
            except core.ApiError as error:
                if error.status not in (400, 401, 403):
                    raise
        if refresh:
            try:
                data = core.supabase('/auth/v1/token?grant_type=refresh_token', method='POST',
                                     data={'refresh_token': refresh})
                core.auth_tokens(data)
                user = core.supabase('/auth/v1/user', token=data['access_token'])
                if isinstance(user, dict) and user.get('id'):
                    return data['access_token'], user, self.login_cookies(data)
            except core.ApiError as error:
                if error.status not in (400, 401, 403):
                    raise
        # Clear invalid credentials on the client.
        return None, None, self.logout_cookies() if (access or refresh) else ()

    def check_post(self):
        # JSON POSTs from Safari's fetch() include Origin, check strict same-site.
        origin = self.headers.get('Origin', '')
        host = self.headers.get('Host', '')
        try:
            parsed = urllib.parse.urlparse(origin)
            if (not origin or parsed.scheme not in ('http', 'https') or
                    parsed.netloc != host or parsed.path not in ('', '/') or
                    parsed.query or parsed.fragment):
                raise core.ApiError('Origen de solicitud no permitido.', 403)
            if self.secure() and parsed.scheme != 'https':
                raise core.ApiError('Se requiere HTTPS.', 403)
        except ValueError as e:
            raise core.ApiError('Origen no permitido.', 403) from e
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            raise core.ApiError('Content-Type inválido.', 415)
        size = int(self.headers.get('Content-Length') or 0)
        if size <= 0 or size > MAX_BODY:
            raise core.ApiError('Tamaño de solicitud inválido.', 413)
        body = json.loads(self.rfile.read(size))
        if not isinstance(body, dict):
            raise core.ApiError('Solicitud inválida.')
        return body

    def do_GET(self):
        self.dispatch('GET')

    def do_POST(self):
        self.dispatch('POST')

    def dispatch(self, method):
        path = urllib.parse.urlsplit(self.path).path
        # Endpoint files have a fixed route in production; /local-dev also has it in path.
        if self.endpoint and path != self.endpoint:
            return self.send_json({'error': 'Ruta inexistente.'}, 404)
        try:
            if path not in ENDPOINTS:
                raise core.ApiError('Ruta inexistente.', 404)
            if method == 'GET':
                if path == '/api/status':
                    return self.send_json({'configured': bool(core.CONFIG), 'cookieAuth': True})
                if path == '/api/auth/session':
                    token, user, cookies = self.authenticated()
                    return self.send_json({'configured': bool(core.CONFIG),
                                           'authenticated': bool(user),
                                           'user': core.safe_user(user) if user else None}, cookies=cookies)
                if path == '/api/cloud/data':
                    token, user, cookies = self.authenticated()
                    if not user:
                        raise core.ApiError('Iniciá sesión para recuperar tus datos.', 401)
                    return self.send_json(core.download_data(token, user['id']), cookies=cookies)
                raise core.ApiError('Método no permitido.', 405)
            body = self.check_post()
            if path == '/api/auth/signup':
                name = body.get('name', '')
                email = body.get('email', '')
                pwd = body.get('password', '')
                if not isinstance(name, str) or not 2 <= len(name.strip()) <= 70:
                    raise core.ApiError('Ingresá tu nombre (entre 2 y 70 caracteres).')
                if not isinstance(email, str) or len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email.strip()):
                    raise core.ApiError('Ingresá un correo electrónico válido.')
                if not isinstance(pwd, str) or not 8 <= len(pwd) <= 200:
                    raise core.ApiError('La contraseña debe tener al menos 8 caracteres.')
                data = core.supabase('/auth/v1/signup', method='POST', data={
                    'email': email.strip(), 'password': pwd,
                    'data': {'full_name': name.strip()}})
                if data.get('access_token'):
                    core.auth_tokens(data)
                    return self.send_json({'authenticated': True, 'user': core.safe_user(data['user'])},
                                          cookies=self.login_cookies(data))
                return self.send_json({'authenticated': False,
                    'message': 'Revisá tu correo y confirmá la cuenta para poder ingresar.'})
            if path == '/api/auth/login':
                email = body.get('email', '')
                pwd = body.get('password', '')
                if not isinstance(email, str) or len(email) > 254 or not isinstance(pwd, str) or not 8 <= len(pwd) <= 200:
                    raise core.ApiError('Revisá tu correo y contraseña.')
                data = core.supabase('/auth/v1/token?grant_type=password', method='POST',
                                     data={'email': email.strip(), 'password': pwd})
                core.auth_tokens(data)
                return self.send_json({'authenticated': True, 'user': core.safe_user(data['user'])},
                                      cookies=self.login_cookies(data))
            if path == '/api/auth/logout':
                token, user, _ = self.authenticated()
                if token:
                    try:
                        core.supabase('/auth/v1/logout', method='POST', data={}, token=token)
                    except core.ApiError:
                        pass
                return self.send_json({'authenticated': False}, cookies=self.logout_cookies())
            if path == '/api/cloud/sync':
                token, user, cookies = self.authenticated()
                if not user:
                    raise core.ApiError('Iniciá sesión para guardar tus datos.', 401)
                return self.send_json(core.upload_data(body.get('snapshot'), token, user['id']), cookies=cookies)
            raise core.ApiError('Método no permitido.', 405)
        except (ValueError, TypeError, json.JSONDecodeError):
            return self.send_json({'error': 'Solicitud inválida.'}, 400)
        except core.ApiError as e:
            return self.send_json({'error': str(e)}, e.status if 400 <= e.status <= 599 else 502)
        except Exception as e:
            print('Percí API error:', type(e).__name__)
            return self.send_json({'error': 'No se pudo completar la operación.'}, 500)


if __name__ == '__main__':
    # Local-only smoke server. Vercel does not run a persistent process.
    import mimetypes
    class Local(ApiHandler):
        def do_GET(self):
            path = urllib.parse.urlsplit(self.path).path
            if path.startswith('/api/'):
                return super().do_GET()
            if path == '/':
                path = '/index.html'
            parts = Path(urllib.parse.unquote(path).lstrip('/')).parts
            if (not parts or '..' in parts or (parts[0] not in ('src', 'assets') and
                 '/'.join(parts) not in ('index.html', 'manifest.webmanifest', 'sw.js'))):
                return self.send_error(404)
            f = WEB_ROOT.joinpath(*parts)
            if not f.is_file() or not f.resolve().is_relative_to(WEB_ROOT.resolve()):
                return self.send_error(404)
            content = f.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(content)
    port = int(os.environ.get('PERCI_PORT', '5173'))
    print(f'Percí online-ready (local smoke): http://localhost:{port}')
    print('Supabase:', 'configurado' if core.CONFIG else 'sin configurar')
    HTTPServer(('127.0.0.1', port), Local).serve_forever()
