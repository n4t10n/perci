"""Percí Share v1.6.5: validation/transport adapter for routines shared by code.

Only a *template* is shared. Completed workout sets, activity records,
owner details, user identifiers, progress and training history are excluded.
"""
import re

CODE_RE = re.compile(r'^PERC-[A-Za-z0-9_-]{16}$')


def clean_routine(raw):
    if not isinstance(raw, dict) or not isinstance(raw.get('name'), str):
        raise ValueError('La rutina es inválida.')
    name = raw['name'].strip()
    exercises = raw.get('exercises')
    if not 1 <= len(name) <= 80 or not isinstance(exercises, list) or not 1 <= len(exercises) <= 40:
        raise ValueError('Revisá el nombre y los ejercicios de la rutina.')
    clean = []
    for item in exercises:
        if not isinstance(item, dict) or not isinstance(item.get('name'), str):
            raise ValueError('Ejercicio inválido.')
        exercise = item['name'].strip()
        sets, reps = item.get('sets'), item.get('reps')
        if not 1 <= len(exercise) <= 80 or type(sets) is not int or type(reps) is not int:
            raise ValueError('Ejercicio, series o repeticiones inválidos.')
        if not 1 <= sets <= 15 or not 1 <= reps <= 100:
            raise ValueError('Series y repeticiones fuera de rango.')
        clean.append({'name': exercise, 'sets': sets, 'reps': reps})
    return {'name': name, 'exercises': clean}


def valid_code(code):
    return isinstance(code, str) and CODE_RE.fullmatch(code) is not None


def handle(core, token, data):
    if not isinstance(data, dict):
        raise core.ApiError('Solicitud inválida.', 400)
    action = data.get('action')
    if action == 'create':
        source = data.get('sourceId')
        if not isinstance(source, str) or not 1 <= len(source.strip()) <= 80:
            raise core.ApiError('Identificador de rutina inválido.', 400)
        try:
            routine = clean_routine(data.get('routine'))
        except ValueError as exc:
            raise core.ApiError(str(exc), 400) from exc
        code = core.supabase('/rest/v1/rpc/perci_share_create', method='POST',
                             data={'p_source_id': source, 'p_payload': routine}, token=token)
        if not valid_code(code):
            raise core.ApiError('No pudimos crear el código de la rutina.', 502)
        return {'code': code}
    if action == 'lookup':
        code = data.get('code')
        if not valid_code(code):
            raise core.ApiError('Código inválido. Copialo exactamente como lo recibiste.', 400)
        routine = core.supabase('/rest/v1/rpc/perci_share_get', method='POST',
                                data={'p_code': code}, token=token)
        if routine is None:
            raise core.ApiError('No encontramos esta rutina. El código puede haber vencido o sido revocado.', 404)
        try:
            return {'routine': clean_routine(routine)}
        except ValueError as exc:
            raise core.ApiError('La rutina compartida no tiene un formato válido.', 502) from exc
    if action == 'revoke':
        code = data.get('code')
        if not valid_code(code):
            raise core.ApiError('Código inválido.', 400)
        revoked = core.supabase('/rest/v1/rpc/perci_share_revoke', method='POST',
                                data={'p_code': code}, token=token)
        return {'revoked': revoked is True}
    raise core.ApiError('Operación desconocida.', 400)
