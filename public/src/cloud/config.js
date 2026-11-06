/** Configuración pública de Supabase. Nunca guardar service_role o sb_secret_. */
export const CLOUD_CONFIG_KEY = 'perci_cloud_dev_config_v07';
export const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';

export function validatePublicConfig(url, key) {
  const value = String(url ?? '').trim().replace(/\/$/, '');
  const publicKey = String(key ?? '').trim();
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Ingresá la URL HTTPS de Supabase DEV.'); }
  const hosted = parsed.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname);
  const local = parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname);
  if (!hosted && !local) throw new Error('Usá la URL HTTPS *.supabase.co o un Supabase local en localhost.');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== '/')) throw new Error('La URL debe ser el origen del proyecto, sin rutas ni parámetros.');
  if (publicKey.startsWith('sb_secret_')) throw new Error('No ingreses la clave secreta: usá la clave publishable (sb_publishable_).');
  if (publicKey.startsWith('sb_publishable_') && publicKey.length >= 25) return {url:value, key:publicKey};
  if (/^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(publicKey)) {
    try {
      const payload = JSON.parse(atob(publicKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if (payload.role === 'service_role' || payload.role === 'supabase_admin') throw new Error('Rechazada: esta clave tiene permisos administrativos.');
      if (payload.role !== 'anon') throw new Error('La clave JWT debe ser anon, nunca service_role.');
      return {url:value,key:publicKey};
    } catch(e) { throw new Error(e.message || 'Clave JWT inválida.'); }
  }
  throw new Error('Usá la clave publishable sb_publishable_… o la anon pública legacy.');
}

export function loadPublicConfig() {
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return validatePublicConfig(data.url, data.key);
  } catch { return null; }
}
export function storePublicConfig(url,key) {
  const config = validatePublicConfig(url,key);
  localStorage.setItem(CLOUD_CONFIG_KEY,JSON.stringify(config));
  return config;
}
