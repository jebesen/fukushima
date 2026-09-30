#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Busca las imágenes de assets/images que ya no usa ninguna página.

Por defecto solo LISTA (no borra nada). Para borrarlas de verdad, añade --delete.

    python tools/find_unused.py             # lista las imágenes sin usar y cuánto ocupan
    python tools/find_unused.py --delete    # las borra (y las carpetas que queden vacías)

Se considera «usada» cualquier imagen cuya ruta aparezca en content/, overrides/, index.html, js/, css/, sw.js o manifest.
Las distingue con mayúsculas y minúsculas igual que GitHub Pages.
"""
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
images = root / "assets" / "images"
ref_rx = re.compile(r"assets/images/[^\"'\s)<>?#]+")

refs = set()
for base in ("content", "js", "css", "overrides"):  # overrides: textos actualizados a mano que citan las figuras nuevas
    for f in (root / base).rglob("*"):
        if f.is_file() and f.suffix.lower() in (".html", ".json", ".js", ".css", ".svg"):
            refs.update(ref_rx.findall(f.read_text(encoding="utf-8", errors="ignore")))
for name in ("index.html", "sw.js", "manifest.webmanifest"):
    p = root / name
    if p.exists():
        refs.update(ref_rx.findall(p.read_text(encoding="utf-8", errors="ignore")))

unused = []
for f in sorted(images.rglob("*")):
    if f.is_file():
        rel = "assets/images/" + f.relative_to(images).as_posix()
        if rel not in refs:
            unused.append(f)

total = sum(f.stat().st_size for f in unused)
print(f"Imágenes en assets/images: {sum(1 for f in images.rglob('*') if f.is_file())} · referenciadas: {len(refs)} · SIN USAR: {len(unused)} ({total / 1e6:.1f} MB)\n")
for f in unused:
    print(f"  {f.relative_to(root).as_posix():55s} {f.stat().st_size / 1024:8.0f} KB")

if "--delete" in sys.argv and unused:
    for f in unused:
        f.unlink()
    for d in sorted((p for p in images.rglob("*") if p.is_dir()), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()
    print(f"\nBorradas {len(unused)} imágenes.")
elif unused:
    print("\nNo se ha borrado nada. Si la lista es correcta, ejecuta de nuevo con --delete.")
