"""Genera los iconos de la aplicación (cuadrícula de turnos sobre fondo azul marino)."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
NAVY, GREEN, YELLOW, RED, BLUE = (31, 56, 100), (0, 176, 80), (255, 230, 0), (230, 40, 40), (0, 176, 240)
PATTERN = [
    [GREEN, GREEN, YELLOW, YELLOW],
    [YELLOW, GREEN, GREEN, None],
    [None, RED, GREEN, GREEN],
    [BLUE, YELLOW, YELLOW, GREEN],
]

def icon(size, maskable=False):
    s = size * 4  # dibujar grande y reducir para suavizar bordes
    im = Image.new('RGBA', (s, s), NAVY + (255,) if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if not maskable:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=NAVY)
    pad = s * (0.24 if maskable else 0.17)
    gap = s * 0.035
    cell = (s - 2 * pad - 3 * gap) / 4
    for r, row in enumerate(PATTERN):
        for c, col in enumerate(row):
            x = pad + c * (cell + gap); y = pad + r * (cell + gap)
            d.rounded_rectangle([x, y, x + cell, y + cell], radius=int(cell * 0.18),
                                fill=col if col else (255, 255, 255, 40))
    return im.resize((size, size), Image.LANCZOS)

for size in (192, 512):
    icon(size).save(os.path.join(OUT, f'icon-{size}.png'))
icon(512, maskable=True).save(os.path.join(OUT, 'icon-maskable-512.png'))
icon(180, maskable=True).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
icon(64).save(os.path.join(OUT, 'favicon.png'))
print('iconos generados')
