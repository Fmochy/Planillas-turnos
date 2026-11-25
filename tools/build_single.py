"""Crea dist/planillas-turnos.html: la aplicación entera en un solo archivo, para usarla sin internet
(abrir con doble clic, copiar a un USB, enviar por correo...).

Uso:  python3 tools/build_single.py
"""
import os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

html = read('index.html')

# Quitar lo que solo tiene sentido en la versión web (manifest, iconos, service worker)
html = re.sub(r'\s*<!-- web-only -->.*?<!-- /web-only -->', '', html, flags=re.S)

def inline_css(m):
    return '<style>\n' + read(m.group(1)) + '\n</style>'

def inline_js(m):
    code = read(m.group(1)).replace('</script', '<\\/script')
    return '<script>\n' + code + '\n</script>'

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'planillas-turnos.html')
open(out, 'w', encoding='utf-8').write(html)
print(f'{out}: {len(html) / 1024:.0f} KB')
