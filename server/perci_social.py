"""Percí Social MVP: RPC con JWT personal, sin llave de servicio, emails ni datos fitness."""
import re

_ACTION_RPC = {
    'overview': 'perci_social_overview',
    'setup': 'perci_social_setup',
    'invite': 'perci_social_invite',
    'accept': 'perci_social_accept',
    'remove': 'perci_social_remove',
    'settings': 'perci_social_settings',
    'find': 'perci_social_find',
    'inviteLookup': 'perci_social_invite_lookup',
    'myProfile': 'perci_social_my_profile',
    'profile': 'perci_social_friend_profile',
    'bio': 'perci_social_update_bio',
    'publishRoutine': 'perci_social_publish_routine',
    'unpublishRoutine': 'perci_social_unpublish_routine',
}

def handle(core, token, user_id, action, body=None):
    if not token or not isinstance(user_id, str) or not re.fullmatch(r'[a-fA-F0-9-]{36}', user_id):
        raise core.ApiError('Iniciá sesión para ver tus amistades.', 401)
    if action not in _ACTION_RPC:
        raise core.ApiError('Acción social inválida.', 400)
    data = {} if body is None else body
    if not isinstance(data, dict):
        raise core.ApiError('Solicitud inválida.', 400)
    payload = {}
    if action == 'setup':
        name = data.get('name')
        if not isinstance(name, str) or not 2 <= len(name.strip()) <= 60:
            raise core.ApiError('Nombre social inválido.', 400)
        payload = {'p_name': name.strip()}
    elif action == 'invite':
        code = data.get('code')
        if not isinstance(code, str) or not re.fullmatch(r'[0-9A-F]{16}', code):
            raise core.ApiError('Código de invitación inválido.', 400)
        payload = {'p_code': code}
    elif action == 'settings':
        username = data.get('username')
        discoverable = data.get('emailDiscoverable')
        if not isinstance(username, str) or not re.fullmatch(r'[a-z0-9_]{3,24}', username):
            raise core.ApiError('Nombre de usuario inválido.', 400)
        if type(discoverable) is not bool:
            raise core.ApiError('Configuración de privacidad inválida.', 400)
        payload = {'p_username': username, 'p_email_discoverable': discoverable}
    elif action in ('find', 'inviteLookup'):
        mode, query = data.get('mode'), data.get('query')
        if mode not in ('code', 'username', 'email') or not isinstance(query, str):
            raise core.ApiError('Búsqueda inválida.', 400)
        if mode == 'code' and not re.fullmatch(r'[0-9A-F]{16}', query):
            raise core.ApiError('Código de invitación inválido.', 400)
        if mode == 'username' and not re.fullmatch(r'[a-z0-9_]{3,24}', query):
            raise core.ApiError('Nombre de usuario inválido.', 400)
        if mode == 'email' and (len(query)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', query)):
            raise core.ApiError('Correo de búsqueda inválido.', 400)
        payload = {'p_mode': mode, 'p_query': query}
    elif action == 'profile':
        request_id = data.get('requestId')
        if not isinstance(request_id, str) or not re.fullmatch(r'[a-fA-F0-9-]{36}', request_id):
            raise core.ApiError('Amistad inválida.', 400)
        payload = {'p_friendship_id': request_id}
    elif action == 'bio':
        bio = data.get('bio')
        if not isinstance(bio, str) or len(bio.strip()) > 160:
            raise core.ApiError('La presentación puede tener hasta 160 caracteres.', 400)
        payload = {'p_bio': bio.strip()}
    elif action in ('publishRoutine', 'unpublishRoutine'):
        source_id = data.get('sourceId')
        if not isinstance(source_id, str) or not 1 <= len(source_id) <= 120:
            raise core.ApiError('Identificador de rutina inválido.', 400)
        payload = {'p_source_id': source_id}
        if action == 'publishRoutine':
            from server.perci_share import clean_routine
            try:
                clean = clean_routine(data.get('routine'))
            except ValueError as exc:
                raise core.ApiError(str(exc), 400) from exc
            payload['p_payload'] = clean
    elif action in ('accept', 'remove'):
        request_id = data.get('requestId')
        if not isinstance(request_id, str) or not re.fullmatch(r'[a-fA-F0-9-]{36}', request_id):
            raise core.ApiError('Solicitud inválida.', 400)
        payload = {'p_request_id': request_id}
    result = core.supabase('/rest/v1/rpc/' + _ACTION_RPC[action], method='POST', data=payload, token=token)
    if not isinstance(result, dict):
        raise core.ApiError('Respuesta social inesperada.', 502)
    return result


def friend_avatar(core, token, viewer_id, friendship_id):
    """Read a private avatar only after an accepted friendship check in Supabase.

    The browser never provides an arbitrary Storage user ID or path. The owner's
    identity is resolved by an authenticated SECURITY DEFINER RPC, and Supabase
    Storage enforces a second friend-only RLS check on the object.
    """
    from server import perci_avatar
    if not token or not isinstance(viewer_id, str):
        raise core.ApiError('Iniciá sesión para ver esta foto.', 401)
    if not isinstance(friendship_id, str) or not re.fullmatch(r'[a-fA-F0-9-]{36}', friendship_id):
        raise core.ApiError('Amistad inválida.', 400)
    owner = core.supabase('/rest/v1/rpc/perci_social_avatar_owner',
                          method='POST', data={'p_friendship_id': friendship_id}, token=token)
    if not isinstance(owner, str) or not re.fullmatch(r'[a-f0-9-]{36}', owner) or owner == viewer_id:
        raise core.ApiError('Foto no disponible para esta cuenta.', 404)
    return perci_avatar.fetch(core, token, owner)
