"""Percí v1.7.2: opt-in atomic synchronization against isolated Supabase QA.

CRITICAL: production is legacy until an explicitly approved, coordinated cutover.
Never fall back to legacy writes when the QA feature flag is set incorrectly.
All database access uses the Supabase JWT of the cookie-authenticated account.
"""
import os
import re
import urllib.parse
from server import perci_server as core

MAX_RETRIES = 4
QA_FLAG = 'PERCI_ATOMIC_QA_ENABLED'
QA_REF = 'PERCI_ATOMIC_QA_PROJECT_REF'
DEV_FLAG = 'PERCI_ATOMIC_DEV_ENABLED'
DEV_REF = 'PERCI_ATOMIC_DEV_PROJECT_REF'
DEV_VERCEL_PROJECT = 'prj_vsYW5BNPSo3gjH2N7paREVKiEvln'
QA_SUPABASE_PROJECT = 'vafurtauwarukdcopjnh'


def enabled():
    qa_flag = os.environ.get(QA_FLAG)
    dev_flag = os.environ.get(DEV_FLAG)

    if qa_flag is None and dev_flag is None:
        return False

    if qa_flag is not None and dev_flag is not None:
        raise core.ApiError('Modos atómicos incompatibles.', 503)

    if qa_flag is not None:
        if qa_flag != 'YES_QA_ONLY':
            raise core.ApiError('Configuración atómica QA inválida.', 503)
        if os.environ.get('VERCEL_ENV', '').lower() == 'production':
            raise core.ApiError('QA no puede operar en Production.', 503)
        expected = os.environ.get(QA_REF, '')
        mode = 'QA'
    else:
        if dev_flag != 'YES_DEV_ATOMIC':
            raise core.ApiError('Configuración atómica DEV inválida.', 503)
        if os.environ.get('VERCEL_ENV', '').lower() != 'production':
            raise core.ApiError('DEV atómico requiere Production.', 503)
        if os.environ.get('VERCEL_PROJECT_ID') != DEV_VERCEL_PROJECT:
            raise core.ApiError('Proyecto Vercel DEV no autorizado.', 503)
        expected = os.environ.get(DEV_REF, '')
        if expected == QA_SUPABASE_PROJECT:
            raise core.ApiError('No se puede utilizar Supabase QA en DEV.', 503)
        mode = 'DEV'

    if not re.fullmatch(r'[a-z0-9-]{8,32}', expected):
        raise core.ApiError(f'Referencia Supabase {mode} inválida.', 503)

    config = core.CONFIG
    if not config or not isinstance(config.get('url'), str):
        raise core.ApiError(f'Supabase {mode} no configurado.', 503)

    hostname = urllib.parse.urlsplit(config['url']).hostname
    if hostname != f'{expected}.supabase.co':
        raise core.ApiError(f'Destino Supabase {mode} no autorizado.', 503)

    return True


def revision(token, user):
    if not isinstance(user, str) or not re.fullmatch(r'[0-9a-fA-F-]{36}', user):
        raise core.ApiError('Cuenta de sincronización inválida.', 400)
    path = '/rest/v1/perci_sync_state?' + urllib.parse.urlencode({
        'select': 'revision', 'user_id': 'eq.' + user, 'limit': 1,
    })
    rows = core.supabase(path, token=token)
    if rows is None:
        rows = []
    if not isinstance(rows, list) or len(rows) > 1:
        raise core.ApiError('Revisión de sincronización inesperada.', 502)
    result = rows[0].get('revision') if rows else 0
    if type(result) is not int or result < 0:
        raise core.ApiError('Revisión de sincronización corrupta.', 502)
    return result


def download_data(token, user):
    """Revision fences around multi-table REST reads; no mixed-version snapshot."""
    if not enabled():
        return core.download_data(token, user)
    for _ in range(MAX_RETRIES):
        before = revision(token, user)
        snapshot = core.download_data(token, user)
        # En QA: la configuración inicial vive en perci_profiles (RLS por usuario).
        # Se consulta dentro de las dos lecturas de revisión: no mezclar estados.
        profiles = core.select_rows('perci_profiles', token, user,
                                    'theme,focus,onboarding_done')
        if not isinstance(profiles, list) or len(profiles) > 1:
            raise core.ApiError('Perfil remoto inesperado.', 502)
        meta = {}
        if profiles:
            profile = profiles[0]
            if (profile.get('theme') not in ('dark', 'light', 'system') or
                    profile.get('focus') not in ('gym', 'others', 'both') or
                    type(profile.get('onboarding_done')) is not bool):
                raise core.ApiError('Preferencias de cuenta inválidas.', 502)
            meta = {'theme': profile['theme'], 'focus': profile['focus'],
                    'onboardSeen': profile['onboarding_done']}
        after = revision(token, user)
        if before == after:
            return {**snapshot, **meta, 'revision': after}
    raise core.ApiError('Hubo actualizaciones mientras leíamos. Reintentá la sincronización.', 409)


def validate_deletions(deletions):
    if not isinstance(deletions, dict):
        raise core.ApiError('Borrados inválidos.', 400)
    if not set(deletions).issubset({'routines', 'records', 'habits'}):
        raise core.ApiError('Tipo de borrado no autorizado.', 400)
    total = 0
    for values in deletions.values():
        if (not isinstance(values, list) or len(values) > 100 or
                any(not isinstance(item, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', item)
                    for item in values)):
            raise core.ApiError('Identificadores de borrado inválidos.', 400)
        total += len(values)
    if total > 100:
        raise core.ApiError('Demasiados borrados simultáneos.', 400)
    return deletions


def commit(snapshot, token, user, *, expected, deletions, atomic):
    if not enabled():
        # No fallback: newer clients may bundle deletes into one atomic commit.
        raise core.ApiError('Esta versión necesita el servidor QA transaccional. Conservamos los cambios locales.', 503)
    if atomic is not True or not isinstance(expected, dict):
        raise core.ApiError('Actualizá Percí antes de sincronizar. No se modificaron datos.', 409)
    expected_revision = expected.get('revision')
    if type(expected_revision) is not int or expected_revision < 0:
        raise core.ApiError('Falta la revisión remota. Volvé a comparar los cambios.', 409)
    if not isinstance(snapshot, dict):
        raise core.ApiError('Snapshot inválido.', 400)
    # Client, server and DB each validate their own input boundary.
    core.verify_snapshot(snapshot)
    if snapshot.get('draft'):
        raise core.ApiError('Finalizá o guardá el borrador del entrenamiento primero.', 400)
    deletions = validate_deletions(deletions)
    # user is derived from the authenticated cookie, not from any JSON field.
    result = core.supabase('/rest/v1/rpc/perci_commit_snapshot', method='POST', token=token,
                           data={'p_expected_revision': expected_revision,
                                 'p_snapshot': snapshot, 'p_deletions': deletions})
    if (not isinstance(result, dict) or type(result.get('revision')) is not int or
            result['revision'] != expected_revision + 1):
        raise core.ApiError('No pudimos verificar la revisión confirmada. Conservamos tu borrador.', 502)
    return result
