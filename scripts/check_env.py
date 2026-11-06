"""Show configuration status but never print keys, tokens, or passwords."""
import os
from pathlib import Path
path=Path(__file__).resolve().parents[1]/'.env'
print('Archivo .env en raíz:', 'ENCONTRADO' if path.is_file() else 'NO ENCONTRADO')
keys={}
if path.is_file():
    for line in path.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1);keys[k.strip()]=bool(v.strip().strip('\"\''))
for name in ('SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'):
    print(name+':','PRESENTE' if keys.get(name) or os.environ.get(name) else 'FALTA o vacío')
print('Nota: .env.example es solo una plantilla y no se carga automáticamente.')
