"""Percí Social MVP: RPC con JWT personal, sin llave de servicio, emails ni datos fitness."""
import re

_ACTION_RPC = {
    'overview': 'perci_social_overview',
    'setup': 'perci_social_setup',
    'invite': 'perci_social_invite',
    'accept': 'perci_social_accept',
    'remove': 'perci_social_remove',
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
    elif action in ('accept', 'remove'):
        request_id = data.get('requestId')
        if not isinstance(request_id, str) or not re.fullmatch(r'[a-fA-F0-9-]{36}', request_id):
            raise core.ApiError('Solicitud inválida.', 400)
        payload = {'p_request_id': request_id}
    result = core.supabase('/rest/v1/rpc/' + _ACTION_RPC[action], method='POST', data=payload, token=token)
    if not isinstance(result, dict):
        raise core.ApiError('Respuesta social inesperada.', 502)
    return result
