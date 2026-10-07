#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenera data/search.json (el índice del buscador) a partir del texto actual de content/.

Ejecútalo después de editar el texto de lecciones o tests:

    python tools/rebuild_search.py

Solo usa la biblioteca estándar de Python. Los títulos salen de data/course.json.
"""
import html
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
course = json.loads((root / "data" / "course.json").read_text("utf-8"))


def plain(s):
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)  # las definiciones de los términos emergentes (atributos) no se indexan
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def fragment_text(unit, lesson_id):
    p = root / "content" / unit / f"{lesson_id}.html"
    return plain(p.read_text("utf-8")) if p.exists() else ""


def quiz_text(unit):
    p = root / "content" / unit / "auto.json"
    if not p.exists():
        return ""
    return " ".join(q["text"] for q in json.loads(p.read_text("utf-8"))["questions"])


index = []
for u in course["units"]:
    for l in u["lessons"]:
        text = quiz_text(u["id"]) if l.get("type") == "quiz" else fragment_text(u["id"], l["id"])
        index.append({"u": u["id"], "l": l["id"], "t": l["title"], "x": text})
    for x in u.get("extras", []):
        index.append({"u": u["id"], "l": x["id"], "t": x["title"], "x": fragment_text(u["id"], x["id"])})

(root / "data" / "search.json").write_text(json.dumps(index, ensure_ascii=False), "utf-8")
print(f"data/search.json actualizado: {len(index)} entradas.")
