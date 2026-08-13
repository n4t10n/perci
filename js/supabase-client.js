// Configuración e Inicialización de Supabase
const SUPABASE_URL = "https://qutbzmufdxdkdeiglauv.supabase.co";
const SUPABASE_KEY = "sb_publishable_q8X-CT9iWMr7lVE4dZgklQ_WLWan8-l";

// Asignar al objeto global window sin re-declarar la constante 'supabase'
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);