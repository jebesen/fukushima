#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migra el curso "Fukushima" (App Engine + Jinja2) a un sitio estático.

Uso (desde la carpeta newfuku):
    pip install beautifulsoup4 html5lib pillow
    python tools/migrate.py            # usa ../fukushima como origen
    python tools/migrate.py --src RUTA --spellcheck --all-images

Genera:
    content/<unidad>/<leccion>.html   fragmentos de contenido
    content/<unidad>/auto.json        tests de autoevaluación
    data/course.json                  estructura del curso
    data/search.json                  índice de búsqueda
    assets/images                     solo las imágenes referenciadas (los PDF no se copian)
    icons/*.png                       iconos de la PWA
    CAMBIOS.md                        informe de correcciones y avisos
"""
import argparse
import html
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

try:
    from PIL import Image, ImageDraw
except ImportError:  # sin Pillow no hay width/height ni iconos
    Image = ImageDraw = None

ROOT = Path(__file__).resolve().parent.parent
OVERRIDES = ROOT / "overrides"  # versiones hechas a mano que sustituyen a la migración automática
LOG = defaultdict(list)


def log(cat, msg):
    LOG[cat].append(msg)


def read_text(p):
    raw = Path(p).read_bytes()
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def block(src, name):
    m = re.search(r"\{%\s*block\s+" + name + r"\s*%\}(.*?)\{%\s*endblock\s*%\}", src, re.S)
    return m.group(1) if m else ""


# --------------------------------------------------------------------------
# Erratas (solo correcciones seguras; cada una queda registrada en CAMBIOS.md)
# --------------------------------------------------------------------------
TYPOS = [
    ("nucleo", "núcleo"), ("Nucleo", "Núcleo"), ("utlizar", "utilizar"),
    ("undiad", "unidad"), ("edicio", "edificio"), ("Ecnomía", "Economía"),
    ("operarior", "operarios"), ("reacibir", "recibir"), ("nivels", "niveles"),
    ("tavés", "través"), ("neceario", "necesario"), ("gencia", "agencia"),
    ("desarrola", "desarrolla"), ("LLega", "Llega"), ("17 de Maro", "17 de marzo"),
    ("Dai-chi", "Dai-ichi"), ("Daichi", "Daiichi"), ("Fuikushima", "Fukushima"),
    ("centrla", "central"), ("Emplazaminento", "Emplazamiento"),
    ("ningúna", "ninguna"), ("dificil", "difícil"), ("Steven Chou", "Steven Chu"),
    ("Energia", "Energía"), ("Faculta Psicología", "Facultad de Psicología"),
    ("se orden evacuar", "se ordena evacuar"), ("circalloy", "zircaloy"),
    ("zircalloy", "zircaloy"), ("encuenra", "encuentran"), ("partícipa", "participa"),
    ("alevado", "elevado"), ("Autoevalución", "Autoevaluación"),
    ("por si solo", "por sí solo"), ("una incendio", "un incendio"),
    ("inexistencias", "inexistencia"), ("Cofrentes, , Trillo", "Cofrentes, Trillo"),
    ("tsunamis de más de 38", "tsunamis de más de 38"),  # marcador (sin efecto)
    (" (se requiere Flash para ver la infografía)", ""),
    # --- Revisión ortográfica (septiembre 2026) ---
    ("lEEE", "IEEE"), ("se hico", "se hizo"), ("contexo", "contexto"), ("cumplimento", "cumplimiento"),
    ("Fision", "Fisión"), ("regrigerante", "refrigerante"), ("irelevante", "irrelevante"),
    ("proxidamante", "aproximadamente"), ("reestablezca", "restablezca"),
    ("Figura 7. nstalación", "Figura 7. Instalación"), ("nstalación", "instalación"),
    ("seguriad", "seguridad"), ("centrifugas", "centrífugas"), ("nucleos", "núcleos"),
    ("no habrían victimas mortales", "no habría víctimas mortales"), ("victimas", "víctimas"),
    ("téctónicas", "tectónicas"), ("prepicitado", "precipitado"), ("petroleo", "petróleo"),
    ("atmosfera", "atmósfera"), ("Petabecquerls", "Petabecquerels"), ("Gigabequerels", "Gigabecquerels"),
    ("Ractor", "Reactor"), ("Chalk Rriver", "Chalk River"), ("Robot Racoon", "Robot Raccoon"),
    # unificación de grafias (nombres de las centrales y términos con dos formas en el curso)
    ("Fukushima Daiichi", "Fukushima Dai-ichi"), ("Fukushima Daini", "Fukushima Dai-ni"),
    ("Tokai-mura", "Tokaimura"), ("iodo", "yodo"), ("Iodo", "Yodo"),
    ("Chernóbil", "Chernobyl"),  # decisión del autor: se mantiene la grafia «Chernobyl» en todo el curso
    ("cumularse", "acumularse"), ("fefrigeración", "refrigeración"),
    ("radioactividad", "radiactividad"), ("Radioactividad", "Radiactividad"),
    ("radioactivos", "radiactivos"), ("radioactivo", "radiactivo"),
    ("radioactivas", "radiactivas"), ("radioactiva", "radiactiva"),
]
TYPO_RX = []
for a, b in TYPOS:
    if a == b:
        continue
    pat = re.escape(a)
    if re.match(r"\w", a):
        pat = r"\b" + pat
    if re.search(r"\w$", a):
        pat = pat + r"\b"
    TYPO_RX.append((re.compile(pat), a, b))


# Correcciones tipográficas por expresión regular (espacios sobrantes y restos de guiones de partición)
REGEX_FIXES = [
    (re.compile(r"(?<=\w)\u00ac(?=\w)"), "", "resto de guion de partición «¬»"),
    (re.compile(r"(?<=[\w\)>])[ \u00a0]+([,;])(?=[\s<])"), r"\1", "espacio antes de coma o punto y coma"),
    (re.compile(r"(?<=[A-Za-zÁÉÍÓÚáéíóúñ\)>])[ \u00a0]+(:)(?=\s)"), r"\1", "espacio antes de dos puntos"),
    (re.compile(r"(?<=[A-Za-zÁÉÍÓÚáéíóúñ\)>])[ \u00a0]+(\.)(?=\s|<|$)"), r"\1", "espacio antes de punto"),
    (re.compile(r"\([ \u00a0]+(?=\w)"), "(", "espacio después de «(»"),
    (re.compile(r"(?<=[\w%])[ \u00a0]+\)"), ")", "espacio antes de «)»"),
]


_PROTECT = re.compile(r'((?:src|href)="[^"]*")')  # rutas y URL: nunca se tocan


def fix_typos(text, where):
    parts = _PROTECT.split(text)
    for i in range(0, len(parts), 2):
        parts[i] = _apply_fixes(parts[i], where)
    return "".join(parts)


def _apply_fixes(text, where):
    for rx, a, b in TYPO_RX:
        text, n = rx.subn(b, text)
        if n:
            log("typos", f"{where}: «{a}» → «{b}» ×{n}")
    for rx, b, desc in REGEX_FIXES:
        text, n = rx.subn(b, text)
        if n:
            log("typos", f"{where}: {desc} ×{n}")
    return text


# --------------------------------------------------------------------------
# Iconos Font Awesome 4 → sprite SVG (definido en index.html)
# --------------------------------------------------------------------------
ICON_MAP = {
    "search": "search", "download": "download", "file-pdf-o": "file", "file-o": "file",
    "file-text-o": "file", "chevron-left": "chevron-left", "chevron-right": "chevron-right",
    "calendar": "calendar", "warning": "alert", "exclamation-triangle": "alert",
    "gears": "gears", "gear": "gears", "cog": "gears", "cogs": "gears",
    "bullhorn": "megaphone", "wrench": "wrench", "bullseye": "target",
    "clock-o": "clock", "linkedin-square": "linkedin", "linkedin": "linkedin",
    "check": "check", "remove": "x", "times": "x", "close": "x",
    "external-link": "external", "info-circle": "info",
}
FA_SIZES = {"lg", "2x", "3x", "4x", "5x", "fw", "ul", "li", "spin"}


# --------------------------------------------------------------------------
# Recursos (imágenes y PDF). Resuelve mayúsculas/minúsculas: GitHub Pages
# distingue entre Naoto.jpg y naoto.jpg; Windows no.
# --------------------------------------------------------------------------
JUNK = re.compile(r"^(\._.*|\.DS_Store|desktop\.ini|Thumbs\.db)$", re.I)


class Assets:
    def __init__(self, images_dir):
        self.dir = images_dir
        self.idx = {}
        self.used = {}  # dst_web -> Path origen
        self.refs = defaultdict(set)  # dst_web -> páginas que lo usan
        if images_dir.exists():
            for p in images_dir.rglob("*"):
                if p.is_file() and not JUNK.match(p.name):
                    self.idx[p.relative_to(images_dir).as_posix().lower()] = p

    def resolve(self, web):
        """'assets/images/3/naoto.jpg' -> (ruta_web_correcta, Path) | None"""
        if web.startswith("assets/pdf/"):
            key = "pdf/" + web[len("assets/pdf/"):]
        elif web.startswith("assets/images/"):
            key = web[len("assets/images/"):]
        else:
            return None
        p = self.idx.get(key.lower())
        if not p:
            return None
        rel = p.relative_to(self.dir).as_posix()
        dst = "assets/pdf/" + rel[4:] if rel.lower().startswith("pdf/") else "assets/images/" + rel
        return dst, p

    def mark(self, web, where):
        r = self.resolve(web)
        if not r:
            log("recursos_faltan", f"{where}: no existe {web}")
            return web
        dst, p = r
        if dst != web:
            log("mayusculas", f"{where}: {web} → {dst}")
        self.used[dst] = p
        self.refs[dst].add(where)
        return dst


ASSET_RX = re.compile(r"assets/(?:images|pdf)/[^\"'\s)<>?#]+")


def fix_assets_in_html(s, assets, where):
    return ASSET_RX.sub(lambda m: assets.mark(m.group(0), where), s)


def img_size(p):
    if Image is None:
        return None
    try:
        with Image.open(p) as im:
            return im.size
    except Exception:
        return None


# --------------------------------------------------------------------------
# Estructura del curso (a partir del menú de base.html)
# --------------------------------------------------------------------------
def norm_href(h):
    m = re.fullmatch(r"/?(\d)[/.](Intro|auto|pro\d+|\d+)", h.strip())
    return f"{m.group(1)}/{m.group(2)}" if m else None


def parse_course(base_html):
    soup = BeautifulSoup(base_html, "html5lib")
    inner = soup.select_one(".mainmenu-submenu-inner")
    units = []
    for h4 in inner.find_all("h4"):
        m = re.match(r"\s*(\d+)\.\s*(.*)", h4.get_text(" ", strip=True))
        unit = {"id": m.group(1), "title": m.group(2), "lessons": [], "extras": []}
        ul = h4.find_next_sibling("ul")
        for a in ul.find_all("a"):
            raw = a["href"]
            n = norm_href(raw)
            if raw.startswith("/") and n and not re.fullmatch(r"/\d/\w+", raw):
                log("enlaces", f"menú: enlace roto «{raw}» → «#/{n}»")
            uid, lid = n.split("/")
            title = a.get_text(" ", strip=True)
            kind = "intro" if lid == "Intro" else "quiz" if lid == "auto" else "lesson"
            unit["lessons"].append({"id": lid, "title": title, "type": kind})
        units.append(unit)
    return units


# --------------------------------------------------------------------------
# Conversión de una página
# --------------------------------------------------------------------------
LAYOUT = re.compile(r"^(row|clearfix|container|col-(xs|sm|md|lg)-(offset-)?\d+)$")
DROP_CLASSES = {"img-responsive", "clearfix", "btn-default", "btn-grey", "btn-lg", "btn-primary",
                "pull-left", "pull-right", "table", "table-bordered", "hidden-phone", "show-tooltip"}
BLOCK = {"p", "div", "ul", "ol", "table", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "img",
         "iframe", "blockquote", "pre", "li", "hr", "section", "br"}


def sib(n, step):
    s = n.next_sibling if step > 0 else n.previous_sibling
    while isinstance(s, NavigableString) and not s.strip():
        s = s.next_sibling if step > 0 else s.previous_sibling
    return s


def is_blockish(s):
    return s is None or (isinstance(s, Tag) and s.name in BLOCK)


def svg_icon(soup, name):
    tag = BeautifulSoup(
        f'<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-{name}"></use></svg>',
        "html5lib").svg
    return tag.extract()


def to_figures(soup, main):
    for row in list(main.find_all("div", class_="row")):
        if row.parent is None or row.attrs is None:
            continue
        if "text-right" in row.get("class", []):
            continue
        if not row.find("img") or row.find(["p", "ul", "ol", "table", "iframe"]):
            continue
        cap = row.find("strong")
        fig = soup.new_tag("figure")
        for im in row.find_all("img"):
            fig.append(im.extract())
        fc = None
        if cap:
            fc = soup.new_tag("figcaption")
            fc.append(cap.extract())
            fig.append(fc)
        nxt = row.find_next_sibling()
        if nxt is not None and nxt.name == "div" and {"row", "text-right"} <= set(nxt.get("class", [])):
            smalls = nxt.find_all("small")
            if smalls:
                if fc is None:
                    fc = soup.new_tag("figcaption")
                    fig.append(fc)
                for s in smalls:
                    fc.append(s.extract())
                nxt.decompose()
        row.replace_with(fig)
    for row in main.find_all("div", class_="text-right"):
        if "row" in row.get("class", []):
            row.name = "p"
            row["class"] = ["src"]


def convert_page(path, uid, lid, assets, course_unit):
    where = f"{uid}/{lid}"
    src = read_text(path)
    title = fix_typos(block(src, "title").strip(), where)
    body_src = fix_typos(block(src, "contenido"), where)
    scripts = block(src, "scripts")
    # rutas de recursos antes de parsear (también dentro de data-content)
    body_src = re.sub(r"""(["'(])/?images/pdf/""", r"\1assets/pdf/", body_src)
    body_src = re.sub(r"""(["'(])/?images/""", r"\1assets/images/", body_src)
    body_src = body_src.replace("http://", "https://")
    modal_src = fix_typos(block(src, "modals"), where)
    modal_src = re.sub(r"""(["'(])/?images/""", r"\1assets/images/", modal_src)
    modal_src = modal_src.replace("http://", "https://")
    modals = {}
    for m in BeautifulSoup(modal_src, "html5lib").select("div.modal"):
        t, b = m.select_one(".modal-title"), m.select_one(".modal-body")
        if b is not None:
            modals[m.get("id")] = (t.get_text(" ", strip=True) if t else "Fuentes", b)
    soup = BeautifulSoup(body_src, "html5lib")
    for c in soup.find_all(string=lambda x: isinstance(x, Comment)):
        c.extract()

    if lid == "auto":
        return None, parse_quiz(soup, scripts, title, uid, assets), {"title": title}

    sections = [s for s in soup.body.find_all("div", class_="section", recursive=False)
                if "section-breadcrumbs" not in s.get("class", [])]
    if not sections:
        log("avisos", f"{where}: no se encontró .section; se usa todo el cuerpo")
    main = soup.new_tag("div")
    for s in sections or [soup.body]:
        for c in list(s.contents):
            main.append(c.extract())

    meta = {"title": title, "h2": None, "back": None, "nav": []}
    h2 = main.find("h2")
    if h2 and lid == "Intro" and h2.get_text().strip().lower().startswith("capítulos"):
        h2.decompose()
    elif h2:
        meta["h2"] = h2.get_text(" ", strip=True)
        h2.decompose()
    for a in main.select("a.btn-grey"):
        meta["nav"].append(norm_href(a.get("href", "")))
        if "volver" in a.get_text().lower():
            meta["back"] = norm_href(a.get("href", ""))
        a.decompose()
    if lid == "Intro":
        t = main.select_one("table.jobs-list")
        if t:
            (t.find_parent(class_=re.compile(r"col-md")) or t).decompose()

    to_figures(soup, main)
    for d in list(main.find_all("div")):
        cls = d.get("class", [])
        if d.parent is not None and any(LAYOUT.match(c) for c in cls):
            d.unwrap()

    for h in main.find_all(["h1", "h2"]):
        h.name = "h2"
        h["class"] = ["sec"]
        h.attrs.pop("id", None)

    for f in main.find_all("iframe"):
        f.attrs = {"src": f.get("src", "").replace("http://", "https://"), "title": "Vídeo",
                   "loading": "lazy", "allowfullscreen": "",
                   "referrerpolicy": "strict-origin-when-cross-origin"}
        w = soup.new_tag("div")
        w["class"] = ["video"]
        f.wrap(w)
    for t in main.find_all(["object", "embed"]):
        if "swf" in str(t).lower():
            if "infografia" in str(t).lower() and uid == "2":
                log("flash", f"{where}: infografía Flash del tsunami sustituida por la animación SVG propia (js/tsunami.js)")
                n = soup.new_tag("div")
                n["class"] = ["anim"]
                n["data-anim"] = "tsunami"
                src_p = t.find_next_sibling("p", class_="src")
                if src_p is not None:
                    src_p.clear()
                    src_p.string = "Animación esquemática de elaboración propia (alturas exageradas). Sustituye a la infografía en Flash original."
                t.replace_with(n)
                continue
            log("flash", f"{where}: elemento Flash sustituido por aviso → {str(t)[:120]}")
            n = soup.new_tag("div")
            n["class"] = ["aviso"]
            n.string = "Este recurso interactivo utilizaba Adobe Flash y ya no está disponible."
            t.replace_with(n)
    for t in main.find_all("table"):
        t.attrs = {"class": ["data"]}
        w = soup.new_tag("div")
        w["class"] = ["table-wrap"]
        t.wrap(w)

    for a in main.select('a[data-toggle="popover"]'):
        b = soup.new_tag("button")
        b["type"] = "button"
        b["class"] = ["term"]
        b["data-title"] = a.get("title", "")
        b["data-content"] = a.get("data-content", "")
        if a.get("data-html") == "true":
            b["data-html"] = "1"
        for c in list(a.contents):
            b.append(c.extract())
        a.replace_with(b)

    for a in main.select('a[data-toggle="modal"]'):
        tid = (a.get("data-target") or "").lstrip("#")
        if tid in modals:
            title, mbody = modals.pop(tid)
            d = soup.new_tag("details")
            d["class"] = ["fuentes"]
            s = soup.new_tag("summary")
            s.string = title
            d.append(s)
            for c in list(mbody.children):
                d.append(c.extract())
            a.replace_with(d)
        else:
            log("avisos", f"{where}: enlace a ventana modal «{tid}» sin contenido (eliminado)")
            a.decompose()
    for tid in modals:
        log("avisos", f"{where}: la ventana modal «{tid}» no se enlaza desde el contenido (no incluida)")

    for a in main.find_all("a", href=True):
        h = a["href"]
        n = norm_href(h)
        if n:
            a["href"] = "#/" + n
            if not re.fullmatch(r"/\d/\w+", h):
                log("enlaces", f"{where}: enlace roto «{h}» → «#/{n}»")
        elif h in ("/creditos", "creditos"):
            a["href"] = "#/creditos"
        elif h in ("/", ""):
            a["href"] = "#/"
        elif h.startswith("http") or h.endswith(".pdf"):
            a["target"] = "_blank"
            a["rel"] = "noopener noreferrer"
        if h.startswith("assets/pdf/"):
            # Decisión de diseño: el curso no ofrece descargas en PDF. Se elimina el enlace (y su frase
            # introductoria si queda vacía) y el PDF no se copia.
            par = a.parent
            log("pdf", f"{where}: enlace a PDF eliminado «{a.get_text(' ', strip=True)[:60]}» ({h.split('/')[-1]})")
            a.decompose()
            if par is not None and par.name == "p":
                rest = par.get_text(" ", strip=True)
                if not rest or (len(rest) < 120 and re.search(r"pdf|descarg|link|enlace", rest, re.I)):
                    par.decompose()
            continue
        if "btn" in a.get("class", []) and "/pro" in h:
            a["class"] = a["class"] + ["extra"]

    for i in main.find_all("i", class_="fa"):
        name = next((c[3:] for c in i.get("class", []) if c.startswith("fa-") and c[3:] not in FA_SIZES), None)
        sym = ICON_MAP.get(name)
        if not sym:
            log("avisos", f"{where}: icono Font Awesome sin equivalente «{name}» (eliminado)")
            i.decompose()
        else:
            i.replace_with(svg_icon(soup, sym))

    for im in main.find_all("img"):
        s = im.get("src", "")
        alt = im.get("alt", "")
        if s.startswith("assets/"):
            s = assets.mark(s, where)
            r = assets.resolve(s)
            size = img_size(r[1]) if r else None
        else:
            size = None
            log("avisos", f"{where}: imagen externa o ruta rara «{s}»")
        im.attrs = {"src": s, "alt": alt, "loading": "lazy", "decoding": "async"}
        if size:
            im["width"], im["height"] = str(size[0]), str(size[1])
    for fig in main.find_all("figure"):
        im = fig.find("img")
        cap = fig.find("figcaption")
        if im is not None and not im.get("alt") and cap is not None:
            st = cap.find("strong")
            im["alt"] = (st or cap).get_text(" ", strip=True)

    for br in list(main.find_all("br")):
        if br.parent is None:
            continue
        p, n = sib(br, -1), sib(br, 1)
        if br.parent.name == "p":
            if p is None or n is None:
                br.decompose()
        elif is_blockish(p) or is_blockish(n) or br.parent.name in ("ul", "ol", "table", "figure"):
            br.decompose()
    for p in list(main.find_all("p")):
        if not p.get_text(strip=True) and not p.find(["img", "iframe", "svg", "button", "figure"]):
            p.decompose()
    for a in main.select("a.btn"):
        for s in list(a.find_all(string=True, recursive=False)):
            s.replace_with(re.sub(r"[\s\xa0]+", " ", s))
    for t in main.find_all(True):
        if t.get("class"):
            cls = [c for c in t["class"] if c not in DROP_CLASSES]
            if cls:
                t["class"] = cls
            else:
                del t["class"]

    frag = main.decode_contents()
    frag = fix_assets_in_html(frag, assets, where)
    frag = re.sub(r"\n\s*\n+", "\n", frag).strip() + "\n"
    text = re.sub(r"\s+", " ", main.get_text(" ", strip=True))
    meta["text"] = text
    return frag, None, meta


# --------------------------------------------------------------------------
# Tests de autoevaluación
# --------------------------------------------------------------------------
def inner_html(node, skip=("input", "i", "p", "div")):
    out = []
    for c in node.children:
        if isinstance(c, NavigableString):
            out.append(html.escape(str(c), quote=False))
        elif c.name not in skip:
            out.append(str(c))
    return re.sub(r"\s+", " ", "".join(out)).strip()


def parse_quiz(soup, scripts, title, uid, assets):
    where = f"{uid}/auto"
    form = soup.find("form") or soup.body
    qs, cur = [], None
    for el in form.descendants:
        if not isinstance(el, Tag):
            continue
        in_label = el.find_parent("label") is not None
        if el.name == "p" and not in_label:
            m = re.match(r"\s*(\d+)\s*[.)]\s*(.*)", el.get_text(" ", strip=True), re.S)
            if m:
                cur = {"n": int(m.group(1)), "text": m.group(2).strip(), "image": None,
                       "multiple": False, "options": []}
                qs.append(cur)
        elif el.name == "img" and cur is not None and not in_label:
            cur["image"] = assets.mark(el.get("src", ""), where)
        elif el.name == "input" and cur is not None and el.get("type") in ("radio", "checkbox"):
            label = el.find_parent("label")
            if label is None:
                log("avisos", f"{where}: input sin label en pregunta {cur['n']}")
                continue
            if el.get("type") == "checkbox":
                cur["multiple"] = True
            expl = label.select_one("p.bg-success")
            cur["options"].append({
                "text": inner_html(label),
                "correct": label.select_one("i.green") is not None,
                "check": label.select_one("i.fa-check") is not None,
                "v": el.get("value", ""),
                "why": inner_html(expl, skip=()) if expl else "",
            })
    js = {int(m.group(1)): m.group(2)
          for m in re.finditer(r'resp\["pregunta(\d+)"\]\s*==\s*"(\d+)"', scripts)}
    for q in qs:
        opts = q["options"]
        if not any(o["correct"] for o in opts):  # sin colores: se usa el glifo
            for o in opts:
                o["correct"] = o["check"]
        green = {i for i, o in enumerate(opts) if o["correct"]}
        withwhy = {i for i, o in enumerate(opts) if o["why"]}
        jsv = js.get(q["n"])
        if jsv is not None and not q["multiple"]:
            ji = next((i for i, o in enumerate(opts) if o["v"] == jsv), None)
            if ji is None:
                log("quiz", f"{where}: pregunta {q['n']}: el JS original acepta value={jsv}, que no existe → REVISAR")
            elif green != {ji}:
                gtxt = " / ".join(re.sub(r"<[^>]+>", "", opts[i]["text"])[:50] for i in sorted(green)) or "ninguna"
                log("quiz", f"{where}: pregunta {q['n']} («{q['text'][:60]}…»): el JS original puntúa la opción "
                            f"«{re.sub(r'<[^>]+>', '', opts[ji]['text'])[:50]}» pero el icono verde marca «{gtxt}» "
                            f"(explicación en la opción {sorted(i + 1 for i in withwhy) or 'ninguna'}). Se usa el JS → REVISAR")
                for i, o in enumerate(opts):
                    o["correct"] = i == ji
            elif withwhy and withwhy != {ji}:
                log("quiz", f"{where}: pregunta {q['n']}: la explicación está en la opción {sorted(i + 1 for i in withwhy)} "
                            f"pero la correcta es la {ji + 1} → REVISAR")
        for o in opts:
            o.pop("check", None)
            o.pop("v", None)
    seen = {}
    for q in qs:
        ok = sum(o["correct"] for o in q["options"])
        if len(q["options"]) < 2 or ok == 0:
            log("quiz", f"{where}: pregunta {q['n']} con {len(q['options'])} opciones y {ok} correctas → REVISAR")
        if not q["multiple"] and ok > 1:
            log("quiz", f"{where}: pregunta {q['n']} es de opción única pero marca {ok} correctas → REVISAR")
        for o in q["options"]:
            k = re.sub(r"\W+", " ", o["text"]).lower()
            if len(k) > 30 and k in seen and seen[k] != q["n"]:
                log("quiz", f"{where}: la opción «{o['text'][:60]}…» aparece en las preguntas "
                            f"{seen[k]} y {q['n']} (¿copiar/pegar?) → REVISAR")
            seen[k] = q["n"]
    return {"unit": uid, "title": title, "questions": qs}


# --------------------------------------------------------------------------
# Iconos de la PWA
# --------------------------------------------------------------------------
def make_icons(dst):
    if Image is None:
        log("avisos", "Pillow no instalado: no se generaron los iconos PNG (pip install pillow)")
        return
    out = dst / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        S = size * 4
        im = Image.new("RGB", (S, S), "#0f1b2d")
        d = ImageDraw.Draw(im)
        c, R, r = S / 2, S * 0.30, S * 0.085
        for start in (240, 0, 120):
            d.pieslice((c - R, c - R, c + R, c + R), start, start + 60, fill="#f5c518")
        d.ellipse((c - S * 0.105, c - S * 0.105, c + S * 0.105, c + S * 0.105), fill="#0f1b2d")
        d.ellipse((c - r, c - r, c + r, c + r), fill="#f5c518")
        im.resize((size, size), Image.LANCZOS).save(out / name)


# --------------------------------------------------------------------------
def _flex(text):
    """Expresión que encuentra el texto ignorando saltos de línea y espacios (incluidos los no separables)."""
    return r"\s+".join(re.escape(t) for t in re.split(r"\s+", text.strip()))


def apply_patches(frag, patches, where):
    """Actualiza el texto de una lección de forma integrada. Formato de overrides/patches/<unidad>/<lección>.json:
      {"replace": "texto a buscar", "with": "HTML nuevo"}   sustituye ese fragmento de texto
      {"after": "texto a buscar", "insert": "<p>...</p>"}  añade HTML después del párrafo que lo contiene
    El texto buscado debe ser texto plano contiguo y aparecer una sola vez."""
    for p in patches:
        key = p.get("replace") or p.get("after")
        ms = list(re.finditer(_flex(key), frag))
        if len(ms) != 1:
            log("avisos", f"{where}: PARCHE NO APLICADO ({len(ms)} coincidencias) «{key[:70]}…»")
            continue
        m = ms[0]
        if "replace" in p:
            frag = frag[:m.start()] + p["with"] + frag[m.end():]
        else:
            close = re.compile(r"</(?:p|li)>").search(frag, m.end())
            if not close:
                log("avisos", f"{where}: PARCHE NO APLICADO (no se encuentra el final del párrafo) «{key[:70]}…»")
                continue
            pos = close.end()
            while True:  # si tras el párrafo viene una figura, el texto nuevo va detrás de ella
                fig = re.compile(r"\s*<figure\b.*?</figure>", re.S).match(frag, pos)
                if not fig:
                    break
                pos = fig.end()
            frag = frag[:pos] + "\n" + p["insert"] + frag[pos:]
        log("overrides", f"{where}: texto actualizado «{key[:60]}…»")
    return frag


def apply_quiz_patch(quiz, patches, where):
    """Corrige preguntas concretas de un test. Formato de overrides/quiz/<unidad>.json:
    [{"n": 3, "text": "...", "options": {"4": {"text": "...", "why": "..."}}}]  (las opciones se numeran desde 1)"""
    for p in patches:
        q = next((x for x in quiz["questions"] if x["n"] == p["n"]), None)
        if q is None:
            log("avisos", f"{where}: el parche apunta a la pregunta {p['n']}, que no existe")
            continue
        if "text" in p:
            q["text"] = p["text"]
        for idx, ch in p.get("options", {}).items():
            i = int(idx) - 1
            if 0 <= i < len(q["options"]):
                q["options"][i].update(ch)
            else:
                log("avisos", f"{where}: el parche apunta a la opción {idx} de la pregunta {p['n']}, que no existe")
        log("overrides", f"{where}: pregunta {p['n']} corregida desde overrides/quiz/")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(ROOT.parent / "fukushima"))
    ap.add_argument("--dst", default=str(ROOT))
    ap.add_argument("--all-images", action="store_true", help="copiar también imágenes no referenciadas")
    ap.add_argument("--spellcheck", action="store_true", help="informe de palabras dudosas (pyspellchecker)")
    a = ap.parse_args()
    src, dst = Path(a.src), Path(a.dst)
    tpl = src / "templates"
    if not (tpl / "base.html").exists():
        sys.exit(f"No encuentro {tpl / 'base.html'}. Usa --src RUTA_A_fukushima")

    assets = Assets(src / "images")
    units = parse_course(read_text(tpl / "base.html"))
    search, texts = [], {}
    for u in units:
        udir = tpl / "unidades" / u["id"]
        out = dst / "content" / u["id"]
        out.mkdir(parents=True, exist_ok=True)
        known = {l["id"] for l in u["lessons"]}
        for f in sorted(udir.glob("*.html")):
            if f.stem not in known and not f.stem.startswith("pro"):
                log("avisos", f"{u['id']}/{f.stem}: existe el fichero pero no está en el menú (se añade)")
                u["lessons"].append({"id": f.stem, "title": f.stem, "type": "lesson"})
        for l in list(u["lessons"]):
            path = udir / f"{l['id']}.html"
            if not path.exists():
                log("avisos", f"{u['id']}/{l['id']}: aparece en el menú pero no existe el fichero")
                continue
            ov = OVERRIDES / "content" / u["id"] / f"{l['id']}.html"
            if ov.exists() and l["type"] != "quiz":
                # Lección actualizada a mano (datos más recientes): se usa tal cual, sin convertir la plantilla original.
                frag = ov.read_text("utf-8")
                meta = {"text": re.sub(r"\s+", " ", BeautifulSoup(frag, "html5lib").get_text(" ", strip=True))}
                quiz = None
                log("overrides", f"{u['id']}/{l['id']}: se usa la versión actualizada de overrides/content/{u['id']}/{l['id']}.html")
            else:
                frag, quiz, meta = convert_page(path, u["id"], l["id"], assets, u)
            qp = OVERRIDES / "quiz" / f"{u['id']}.json"
            if quiz and qp.exists():
                apply_quiz_patch(quiz, json.loads(qp.read_text("utf-8")), f"{u['id']}/auto")
            pf = OVERRIDES / "patches" / u["id"] / f"{l['id']}.json"
            if not quiz and pf.exists():
                # Actualización de datos integrada en el texto: sustituye o amplía frases concretas de la lección.
                frag = apply_patches(frag, json.loads(pf.read_text("utf-8")), f"{u['id']}/{l['id']}")
                meta["text"] = re.sub(r"\s+", " ", BeautifulSoup(frag, "html5lib").get_text(" ", strip=True))
            if quiz:
                (out / "auto.json").write_text(json.dumps(quiz, ensure_ascii=False, indent=1), "utf-8")
                txt = " ".join(q["text"] for q in quiz["questions"])
            else:
                (out / f"{l['id']}.html").write_text(frag, "utf-8")
                txt = meta["text"]
                texts[f"{u['id']}/{l['id']}"] = txt
            search.append({"u": u["id"], "l": l["id"], "t": l["title"], "x": txt})
        for f in sorted(udir.glob("pro*.html")):
            frag, _, meta = convert_page(f, u["id"], f.stem, assets, u)
            (out / f"{f.stem}.html").write_text(frag, "utf-8")
            title = meta["h2"] or meta["title"] or f.stem
            u["extras"].append({"id": f.stem, "title": title, "parent": (meta["back"] or "").split("/")[-1]})
            search.append({"u": u["id"], "l": f.stem, "t": title, "x": meta["text"]})
            texts[f"{u['id']}/{f.stem}"] = meta["text"]
        # comprobar navegación original (prev/next) frente al orden del menú
        ids = [l["id"] for l in u["lessons"]]
        for i, lid in enumerate(ids):
            if lid == "auto":
                continue
            p = udir / f"{lid}.html"
            if not p.exists():
                continue
            navs = [norm_href(m) for m in re.findall(r'class="btn btn-grey[^"]*"[^>]*href="([^"]+)"', read_text(p))
                    + re.findall(r'href="([^"]+)"[^>]*class="btn btn-grey', read_text(p))]
            want = {f"{u['id']}/{ids[j]}" for j in (i - 1, i + 1) if 0 <= j < len(ids)}
            extra = {n for n in navs if n and n not in want}
            if extra:
                log("enlaces", f"{u['id']}/{lid}: los botones anterior/siguiente originales apuntan a "
                               f"{sorted(extra)} y el orden del menú sugiere {sorted(want)} → REVISAR")

    (dst / "data").mkdir(exist_ok=True)
    (dst / "data" / "course.json").write_text(json.dumps(
        {"title": "OpenCourseWare: El accidente nuclear de Fukushima", "units": units},
        ensure_ascii=False, indent=1), "utf-8")
    (dst / "data" / "search.json").write_text(json.dumps(search, ensure_ascii=False), "utf-8")

    # recursos fijos de la interfaz
    for rel in ("images/logo.png", "images/logo_uned.png", "images/CC.png", "images/equipo/jesus.jpg",
                "images/equipo/mercedes.jpg", "images/iconos/icon1.png", "images/iconos/icon2.png",
                "images/iconos/icon3.png"):
        assets.mark("assets/" + rel, "interfaz")

    # copia de recursos
    for web, p in sorted(assets.used.items()):
        t = dst / web
        t.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, t)
        if p.stat().st_size > 50 * 1024 * 1024:
            log("avisos", f"{web} pesa {p.stat().st_size / 1e6:.0f} MB (GitHub avisa a partir de 50 MB y "
                          f"rechaza más de 100 MB). Usado en: {', '.join(sorted(assets.refs[web]))}")
    unused = [k for k in assets.idx if not any(k == (w[len('assets/images/'):] if w.startswith('assets/images/')
              else 'pdf/' + w[len('assets/pdf/'):]).lower() for w in assets.used)]
    for k in unused:
        p = assets.idx[k]
        if p.suffix.lower() == ".pdf":
            continue  # el curso no distribuye PDF
        elif a.all_images:
            t = dst / "assets" / "images" / p.relative_to(assets.dir)
            t.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, t)
        elif p.suffix.lower() == ".swf":
            log("flash", f"{p.name}: no se copia (Flash ya no funciona en ningún navegador)")
        else:
            log("sin_usar", f"imagen sin referencias (no copiada): {p.relative_to(assets.dir).as_posix()}")

    make_icons(dst)

    # Figuras generadas por código (apartado 1.1): gráficos SVG con datos recientes
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import make_charts
        made = make_charts.build(dst / "assets" / "images" / "1")
        log("overrides", f"figuras SVG generadas con tools/make_charts.py: {', '.join(made)}")
    except Exception as e:  # noqa: BLE001
        log("avisos", f"no se pudieron generar las figuras (tools/make_charts.py): {e}")

    if a.spellcheck:
        try:
            from spellchecker import SpellChecker
            sp = SpellChecker(language="es")
            cnt = defaultdict(lambda: defaultdict(int))
            for k, t in texts.items():
                for w in re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{5,}", t):
                    if w[0].isupper() or w.isupper():
                        continue
                    if w.lower() in sp.unknown([w.lower()]):
                        cnt[w.lower()][k] += 1
            for w, where in sorted(cnt.items()):
                log("ortografia", f"«{w}» — " + ", ".join(f"{k} ×{n}" for k, n in where.items()))
        except ImportError:
            log("avisos", "--spellcheck requiere: pip install pyspellchecker")

    write_report(dst)
    print(f"Listo. Unidades: {len(units)} · recursos copiados: {len(assets.used)}")
    print("Revisa CAMBIOS.md (correcciones y avisos).")


def write_report(dst):
    titles = {
        "typos": "Erratas corregidas automáticamente",
        "enlaces": "Enlaces corregidos o a revisar",
        "mayusculas": "Rutas de recursos con mayúsculas corregidas (GitHub Pages distingue mayúsculas)",
        "recursos_faltan": "Recursos referenciados que NO existen",
        "quiz": "Tests de autoevaluación: incidencias",
        "flash": "Contenido Flash",
        "overrides": "Contenido actualizado a mano y figuras generadas (overrides/ y make_charts.py)",
        "pdf": "Enlaces a PDF eliminados (el curso no ofrece descargas)",
        "avisos": "Otros avisos",
        "sin_usar": "Recursos sin referencias",
        "ortografia": "Palabras dudosas (revisión manual)",
    }
    L = ["# Informe de migración", ""]
    for k, t in titles.items():
        if LOG.get(k):
            L += [f"## {t}", ""] + [f"- {m}" for m in sorted(set(LOG[k]))] + [""]
    (dst / "CAMBIOS.md").write_text("\n".join(L), "utf-8")


if __name__ == "__main__":
    main()
