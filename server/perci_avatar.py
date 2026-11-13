"""Percí v1.13.0: private, authenticated Supabase Storage avatars.

Avatar bytes are *never* written to the workout snapshot, the public assets,
Vercel disk, or a public Storage URL. Every request is scoped to the user ID
returned by Supabase Auth in api/shared.py. No service-role key is used.
"""
import base64
import binascii
import json
import re
import urllib.error
import urllib.request
import uuid

BUCKET = 'perci-avatars-qa'
MAX_AVATAR_BYTES = 200_000
MAX_RESPONSE_BYTES = 260_000


def _object_path(user_id):
    """Reject path traversal and derive the only allowed object from auth.uid."""
    try:
        normalized = str(uuid.UUID(str(user_id)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError('Identificador de cuenta inválido.') from exc
    if str(user_id) != normalized:
        raise ValueError('Identificador de cuenta inválido.')
    return f'/storage/v1/object/{BUCKET}/{normalized}/avatar.webp'


def _size_webp(raw):
    """Read dimensions from standard VP8/VP8L/VP8X headers, without decoding."""
    if not isinstance(raw, bytes) or len(raw) < 30 or raw[:4] != b'RIFF' or raw[8:12] != b'WEBP':
        return None
    if int.from_bytes(raw[4:8], 'little') + 8 != len(raw):
        return None
    kind = raw[12:16]
    if kind == b'VP8 ' and raw[23:26] == b'\x9d\x01\x2a':
        width = int.from_bytes(raw[26:28], 'little') & 0x3fff
        height = int.from_bytes(raw[28:30], 'little') & 0x3fff
    elif kind == b'VP8L' and raw[20] == 0x2f:
        a, b, c, d = raw[21:25]
        width = 1 + (a | ((b & 0x3f) << 8))
        height = 1 + ((b >> 6) | (c << 2) | ((d & 0x0f) << 10))
    elif kind == b'VP8X':
        width = 1 + int.from_bytes(raw[24:27], 'little')
        height = 1 + int.from_bytes(raw[27:30], 'little')
    else:
        return None
    return width, height


def validate_image(core, encoded):
    if not isinstance(encoded, str) or not encoded or len(encoded) > 275_000:
        raise core.ApiError('La foto supera el tamaño permitido (200 KB).', 413)
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise core.ApiError('La foto no tiene un formato válido.', 400) from exc
    dims = _size_webp(raw)
    if not dims or not 128 <= dims[0] <= 1024 or dims[0] != dims[1]:
        raise core.ApiError('La foto debe ser una imagen WebP cuadrada y válida.', 400)
    if len(raw) > MAX_AVATAR_BYTES:
        raise core.ApiError('La foto supera el tamaño permitido (200 KB).', 413)
    return raw


def _storage(core, path, token, *, method='GET', raw=None):
    if not core.CONFIG:
        raise core.ApiError('El almacenamiento de la cuenta no está configurado.', 503)
    if not path.startswith('/storage/v1/object/') or '://' in path:
        raise core.ApiError('Ruta de imagen inválida.', 400)
    headers = {'apikey': core.CONFIG['key'], 'Authorization': 'Bearer ' + token,
               'Accept': 'application/json' if method != 'GET' else 'image/webp'}
    if method == 'POST':
        headers.update({'Content-Type': 'image/webp', 'x-upsert': 'true', 'cache-control': 'max-age=0'})
    req = urllib.request.Request(core.CONFIG['url'] + path, data=raw, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            data = response.read(MAX_RESPONSE_BYTES + 1)
            if len(data) > MAX_RESPONSE_BYTES:
                raise core.ApiError('La foto devuelta supera el tamaño permitido.', 502)
            return data
    except urllib.error.HTTPError as e:
        if method in ('GET', 'DELETE') and e.code == 404:
            return None
        if e.code in (401, 403):
            raise core.ApiError('No tenés permiso para acceder a esta foto.', 403) from e
        if e.code == 404:
            raise core.ApiError('El espacio privado de fotos de QA todavía no está configurado.', 503) from e
        if e.code in (400, 413, 415):
            raise core.ApiError('No se pudo guardar la foto. Revisá el formato o el tamaño.', 400) from e
        raise core.ApiError('No pudimos acceder a las fotos. Intentá nuevamente.', 503) from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise core.ApiError('Sin conexión con el almacenamiento de fotos.', 503) from e


def fetch(core, token, user_id):
    path = _object_path(user_id)
    # Authenticated private object endpoint. The path is *never* user-provided.
    private = path.replace('/storage/v1/object/', '/storage/v1/object/authenticated/', 1)
    raw = _storage(core, private, token)
    if raw is None:
        return {'present': False, 'image': None, 'ownerId': user_id}
    if len(raw) > MAX_AVATAR_BYTES or not _size_webp(raw):
        raise core.ApiError('No se pudo validar la foto guardada.', 502)
    return {'present': True, 'image': 'data:image/webp;base64,' + base64.b64encode(raw).decode('ascii'), 'ownerId': user_id}


def update(core, token, user_id, body):
    path = _object_path(user_id)
    if body.get('ownerId') != user_id:
        raise core.ApiError('La sesión de la cuenta cambió. Volvé a ingresar.', 403)
    action = body.get('action')
    if action == 'save':
        if body.get('mime') != 'image/webp':
            raise core.ApiError('Solo aceptamos fotos procesadas en formato WebP.', 415)
        raw = validate_image(core, body.get('image'))
        _storage(core, path, token, method='POST', raw=raw)
        return {'saved': True, 'ownerId': user_id}
    if action == 'remove':
        _storage(core, path, token, method='DELETE')
        return {'removed': True, 'ownerId': user_id}
    raise core.ApiError('Acción de foto no permitida.', 400)
