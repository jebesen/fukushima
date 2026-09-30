#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera las figuras del apartado 1.1 como gráficos SVG (sin dependencias, solo la biblioteca estándar).

Las cifras están escritas aquí, con su fuente, para poder revisarlas y actualizarlas:
edita los datos, ejecuta `python tools/make_charts.py` (o `python tools/migrate.py`, que lo llama) y listo.

Datos recogidos en septiembre de 2026:
  * OIEA (IAEA): «Nuclear Power Reactors in the World» (RDS-2, edición 2026) y proyecciones «up to 2060» (sept. 2026).
  * World Nuclear Association (WNA): «Nuclear Power in the World Today» (actualizado 29/09/2026), con datos del IAEA PRIS.
  * Ember: «Global Electricity Review 2026» (mayo de 2026), datos de 2025.
  * Red Eléctrica de España: «El sistema eléctrico español en 2025» (marzo de 2026).
"""
import math
import textwrap
from pathlib import Path
from xml.sax.saxutils import escape

FONT = "Segoe UI, Roboto, Helvetica, Arial, sans-serif"
INK, MUTED, GRID = "#1b2836", "#5b6776", "#e3e8ee"
BAR, HI, ALT, LIGHT = "#2b5d94", "#f5a800", "#8fb0d6", "#c9d8ea"
W = 760


def num(v, dec=0):
    """Formato español: 1.045 · 8,9"""
    return f"{v:,.{dec}f}".replace(",", "§").replace(".", ",").replace("§", ".")


def nice_step(vmax, n=5):
    raw = vmax / n
    mag = 10 ** math.floor(math.log10(raw))
    for m in (1, 2, 2.5, 5, 10):
        if raw <= m * mag:
            return m * mag
    return 10 * mag


def wrap(lines, width=112):
    out = []
    for ln in lines:
        out += textwrap.wrap(ln, width=width) or [""]
    return out


def svg(height, inner, title, desc):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {height}" width="{W}" height="{height}" '
        f'role="img" aria-labelledby="t d" font-family="{FONT}">\n'
        f'<title id="t">{escape(title)}</title><desc id="d">{escape(desc)}</desc>\n'
        f'<rect width="{W}" height="{height}" rx="12" fill="#ffffff"/>\n{inner}</svg>\n'
    )


def header(title, subtitle):
    s = f'<text x="24" y="32" font-size="18" font-weight="700" fill="{INK}">{escape(title)}</text>\n'
    if subtitle:
        s += f'<text x="24" y="53" font-size="12.5" fill="{MUTED}">{escape(subtitle)}</text>\n'
    return s


def footer(y, notes):
    s = ""
    for i, ln in enumerate(wrap(notes)):
        s += f'<text x="24" y="{y + i * 15}" font-size="11" fill="{MUTED}">{escape(ln)}</text>\n'
    return s, y + len(wrap(notes)) * 15


def hbar(title, subtitle, items, notes, unit="", dec=0, hi=(), label_w=178, vline=None, desc="", vmax=None):
    """Barras horizontales. items = [(etiqueta, valor)]; hi = etiquetas destacadas."""
    rh, bh, top = 28, 18, 76
    plot_w = W - label_w - 96
    step = nice_step(vmax or max(v for _, v in items))
    scale_max = vmax or math.ceil(max(v for _, v in items) / step) * step
    x0 = label_w
    inner = header(title, subtitle)
    n = len(items)
    y_end = top + n * rh
    t = 0
    while t <= scale_max + 1e-9:
        x = x0 + t / scale_max * plot_w
        inner += f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{top - 6}" y2="{y_end}" stroke="{GRID}"/>\n'
        inner += f'<text x="{x:.1f}" y="{y_end + 16}" font-size="11" fill="{MUTED}" text-anchor="middle">{num(t)}</text>\n'
        t += step
    if vline:  # se dibuja antes que las barras y las etiquetas para quedar por detrás
        x = x0 + vline[0] / scale_max * plot_w
        inner += f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{top - 10}" y2="{y_end}" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="5 4"/>\n'
        inner += f'<text x="{x + 5:.1f}" y="{top - 12}" font-size="11" fill="#c0392b">{escape(vline[1])}</text>\n'
    for i, (lab, v) in enumerate(items):
        y = top + i * rh
        w = max(1.5, v / scale_max * plot_w)
        col = HI if lab in hi else BAR
        weight = "700" if lab in hi else "400"
        inner += f'<text x="{x0 - 10}" y="{y + bh - 4}" font-size="13" fill="{INK}" font-weight="{weight}" text-anchor="end">{escape(lab)}</text>\n'
        inner += f'<rect x="{x0}" y="{y}" width="{w:.1f}" height="{bh}" rx="3" fill="{col}"/>\n'
        val = f"{num(v, dec)}{unit}"
        tx, ty = f"{x0 + w + 6:.1f}", y + bh - 4
        # halo blanco (copia debajo) para que la cifra se lea aunque la cruce la línea de referencia
        inner += f'<text x="{tx}" y="{ty}" font-size="13" font-weight="700" fill="#ffffff" stroke="#ffffff" stroke-width="4" stroke-linejoin="round">{val}</text>\n'
        inner += f'<text x="{tx}" y="{ty}" font-size="13" font-weight="700" fill="{INK}">{val}</text>\n'
    f_txt, y_last = footer(y_end + 40, notes)
    return svg(y_last + 14, inner + f_txt, title, desc or f"{title}. " + "; ".join(f"{a}: {num(v, dec)}{unit}" for a, v in items))


def columns(title, subtitle, cols, notes, legend=(), plot_h=220, desc="", dec=0, ymax=None):
    """Columnas. cols = [{'label': [líneas], 'bars': [{'v':..,'color':..,'text':..}]}]"""
    top = 84 if legend else 76
    bw, gap_in, gap_grp = 76, 12, 54
    total_w = sum(len(c["bars"]) * bw + (len(c["bars"]) - 1) * gap_in for c in cols) + gap_grp * (len(cols) - 1)
    x = (W - total_w) / 2
    vmax = ymax or max(b["v"] for c in cols for b in c["bars"])
    base = top + plot_h
    inner = header(title, subtitle)
    step = nice_step(vmax)
    scale_max = ymax or math.ceil(vmax / step) * step
    t = 0
    while t <= scale_max + 1e-9:
        y = base - t / scale_max * plot_h
        inner += f'<line x1="24" x2="{W - 24}" y1="{y:.1f}" y2="{y:.1f}" stroke="{GRID}"/>\n'
        t += step
    lx = 24
    for col, txt in legend:
        inner += f'<rect x="{lx}" y="62" width="12" height="12" rx="2" fill="{col}"/><text x="{lx + 17}" y="72" font-size="12" fill="{INK}">{escape(txt)}</text>\n'
        lx += 34 + 7 * len(txt)
    for c in cols:
        gx = x
        for b in c["bars"]:
            h = max(2, b["v"] / scale_max * plot_h)
            inner += f'<rect x="{x:.1f}" y="{base - h:.1f}" width="{bw}" height="{h:.1f}" rx="3" fill="{b["color"]}"/>\n'
            inner += f'<text x="{x + bw / 2:.1f}" y="{base - h - 7:.1f}" font-size="14" font-weight="700" fill="{INK}" text-anchor="middle">{escape(b.get("text") or num(b["v"], dec))}</text>\n'
            x += bw + gap_in
        x -= gap_in
        cx = (gx + x) / 2
        for k, ln in enumerate(c["label"]):
            inner += f'<text x="{cx:.1f}" y="{base + 20 + k * 15}" font-size="{12.5 if k == 0 else 11.5}" font-weight="{600 if k == 0 else 400}" fill="{INK if k == 0 else MUTED}" text-anchor="middle">{escape(ln)}</text>\n'
        x += gap_grp
    f_txt, y_last = footer(base + 20 + 15 * max(len(c["label"]) for c in cols) + 22, notes)
    return svg(y_last + 14, inner + f_txt, title, desc)


def build(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    files = {}

    # Figura 1 — reactores operables por país (WNA, 29/09/2026)
    files["fig1-reactores-operables.svg"] = hbar(
        "Reactores nucleares operables por país",
        "441 reactores en 31 países · 404 GW(e) de potencia neta · septiembre de 2026",
        [("EE. UU.", 94), ("China", 64), ("Francia", 57), ("Rusia", 34), ("Japón (*)", 33), ("Corea del Sur", 26),
         ("India", 24), ("Canadá", 17), ("Ucrania", 15), ("Reino Unido", 9), ("España", 7), ("Otros 20 países", 61)],
        ["Operable = conectado a la red. (*) Japón: 33 reactores operables, de los que una parte permanece parada a largo plazo.",
         "Fuente: World Nuclear Association, «Nuclear Power in the World Today» (29/09/2026), con datos del IAEA PRIS. Elaboración propia."],
        hi=("España",),
        desc="Gráfico de barras de reactores operables: EE. UU. 94, China 64, Francia 57, Rusia 34, Japón 33, Corea del Sur 26, India 24, "
             "Canadá 17, Ucrania 15, Reino Unido 9, España 7 y otros 20 países 61. Total mundial: 441.")

    # Figura 2 — reactores en construcción por país
    files["fig2-reactores-construccion.svg"] = hbar(
        "Reactores nucleares en construcción por país",
        "81 reactores en 17 países · septiembre de 2026",
        [("China", 39), ("India", 8), ("Rusia", 7), ("Corea del Sur", 4), ("Egipto", 4), ("Turquía", 4), ("Bangladés", 2),
         ("Japón", 2), ("Reino Unido", 2), ("Ucrania", 2), ("Otros 7 países (1 c/u)", 7)],
        ["Incluye 6 unidades con la construcción suspendida (CAREM-25, Angra 3, Ohma 1, Shimane 3 y Khmelnitski 3 y 4).",
         "Fuente: World Nuclear Association, «Nuclear Power in the World Today» (29/09/2026), con datos del IAEA PRIS. Elaboración propia."],
        hi=("China",), label_w=196,
        desc="Gráfico de barras de reactores en construcción: China 39, India 8, Rusia 7, Corea del Sur, Egipto y Turquía 4 cada uno, "
             "Bangladés, Japón, Reino Unido y Ucrania 2 cada uno y otros siete países 1 cada uno. Total: 81.")

    # Figura 3 — estado del parque nuclear mundial
    files["fig3-estado-mundial.svg"] = columns(
        "Estado del parque nuclear mundial",
        "Número de reactores según su situación · septiembre de 2026",
        [{"label": ["Operables", "404 GW(e) netos"], "bars": [{"v": 441, "color": BAR}]},
         {"label": ["En construcción", "88 GW(e) brutos"], "bars": [{"v": 81, "color": HI}]},
         {"label": ["Planificados", "111 GW(e) brutos"], "bars": [{"v": 122, "color": ALT}]},
         {"label": ["Propuestos", "299 GW(e) brutos"], "bars": [{"v": 336, "color": LIGHT}]}],
        ["Planificados: con aprobaciones o financiación, en su mayoría previstos en los próximos 15 años. Propuestos: con programa o emplazamiento, "
         "pero con calendario muy incierto.",
         "Fuente: World Nuclear Association, «Nuclear Power in the World Today» (29/09/2026), con datos del IAEA PRIS. Elaboración propia."],
        desc="Gráfico de columnas: 441 reactores operables, 81 en construcción, 122 planificados y 336 propuestos en el mundo.")

    # Figura 4 — mix eléctrico mundial 2025 (Ember)
    files["fig4-mix-mundial-2025.svg"] = hbar(
        "Mix de generación de electricidad en el mundo, 2025",
        "Porcentaje de la generación eléctrica mundial",
        [("Carbón", 33.0), ("Gas natural", 21.8), ("Hidráulica", 14.0), ("Nuclear", 8.9), ("Solar", 8.7), ("Eólica", 8.5),
         ("Otras (*)", 5.1)],
        ["(*) Petróleo, bioenergía y otras renovables (por diferencia). Las renovables en conjunto suman el 34 % y superan al carbón por primera vez en más de un siglo.",
         "Según el IAEA la nuclear aportó el 8,4 % en 2025 (8,7 % en 2024); la diferencia con Ember se debe a la metodología.",
         "Fuente: Ember, «Global Electricity Review 2026» (mayo de 2026). Elaboración propia."],
        unit=" %", dec=1, hi=("Nuclear",), vmax=40,
        desc="Gráfico de barras del mix eléctrico mundial en 2025: carbón 33,0 %, gas 21,8 %, hidráulica 14 %, nuclear 8,9 %, solar 8,7 %, "
             "eólica 8,5 % y otras 5,1 %.")

    # Figura 5 — peso de la nuclear en la electricidad por país, 2025 (WNA)
    files["fig5-peso-nuclear-paises.svg"] = hbar(
        "Peso de la energía nuclear en la electricidad de cada país, 2025",
        "Los 14 países que generaron al menos una cuarta parte de su electricidad con nuclear, y algunos de referencia",
        [("Francia", 68.1), ("Eslovaquia", 64.4), ("Ucrania", 52.0), ("Hungría", 45.2), ("Chequia", 42.1), ("Eslovenia", 39.7),
         ("Finlandia", 39.6), ("Bielorrusia", 39.5), ("Bulgaria", 38.3), ("Bélgica", 33.7), ("Corea del Sur", 31.0), ("Armenia", 30.6),
         ("Suiza", 27.1), ("Suecia", 26.7), ("España", 18.9), ("Rusia", 18.7), ("EE. UU.", 17.7), ("Japón", 9.4), ("China", 5.0)],
        ["Media mundial: alrededor del 9 %.",
         "Fuente: World Nuclear Association, «Nuclear Power in the World Today» (29/09/2026), con datos del IAEA PRIS. Elaboración propia."],
        unit=" %", dec=1, hi=("España",), vmax=80, vline=(25, "25 %"),
        desc="Gráfico de barras del porcentaje de electricidad de origen nuclear en 2025: Francia 68,1 %, Eslovaquia 64,4 %, Ucrania 52 %, "
             "Hungría 45,2 %, Chequia 42,1 %, Eslovenia 39,7 %, Finlandia 39,6 %, Bielorrusia 39,5 %, Bulgaria 38,3 %, Bélgica 33,7 %, "
             "Corea del Sur 31 %, Armenia 30,6 %, Suiza 27,1 %, Suecia 26,7 %, España 18,9 %, Rusia 18,7 %, EE. UU. 17,7 %, Japón 9,4 % y China 5 %.")

    # Figura 6 — proyecciones del OIEA
    files["fig6-proyecciones-oiea.svg"] = columns(
        "Proyecciones de capacidad nuclear mundial del OIEA",
        "Potencia instalada en GW(e), hasta 2060",
        [{"label": ["2025", "dato real"], "bars": [{"v": 377.1, "color": BAR, "text": "377"}]},
         {"label": ["2050"], "bars": [{"v": 641, "color": ALT}, {"v": 1045, "color": HI}]},
         {"label": ["2060"], "bars": [{"v": 696, "color": ALT}, {"v": 1284, "color": HI}]}],
        ["En 2025 había 413 reactores operativos (377,1 GW(e)). El caso alto supone 3,4 veces la capacidad de 2025 en 2060.",
         "Fuente: IAEA, «Energy, Electricity and Nuclear Power Estimates for the Period up to 2060» (46.ª edición, septiembre de 2026). Elaboración propia."],
        legend=[(BAR, "Real 2025"), (ALT, "Caso bajo"), (HI, "Caso alto")], plot_h=230,
        desc="Gráfico de columnas: 377 GW(e) en 2025; en 2050, 641 en el caso bajo y 1.045 en el alto; en 2060, 696 en el bajo y 1.284 en el alto.")

    # Figura 7 — mix eléctrico peninsular de España, 2025 (REE)
    files["fig7-mix-espana-2025.svg"] = hbar(
        "Mix de generación de electricidad en España, 2025",
        "Porcentaje de la generación del sistema peninsular",
        [("Eólica", 21.6), ("Nuclear", 19.0), ("Solar fotovoltaica", 18.4), ("Ciclo combinado", 16.8), ("Hidráulica", 12.4),
         ("Otras tecnologías (*)", 11.8)],
        ["(*) Por diferencia. Las renovables generaron el 55,5 % de la electricidad del conjunto del sistema. La nuclear fue la segunda fuente, "
         "con el 5 % de la potencia instalada (7,1 GW de 142,5 GW).",
         "Fuente: Red Eléctrica de España, «El sistema eléctrico español en 2025» (marzo de 2026). Elaboración propia."],
        unit=" %", dec=1, hi=("Nuclear",), vmax=25, label_w=190,
        desc="Gráfico de barras del mix peninsular español en 2025: eólica 21,6 %, nuclear 19 %, solar fotovoltaica 18,4 %, "
             "ciclo combinado 16,8 %, hidráulica 12,4 % y otras tecnologías 11,8 %.")

    for name, content in files.items():
        (out / name).write_text(content, encoding="utf-8")
    return sorted(files)


if __name__ == "__main__":
    dst = Path(__file__).resolve().parent.parent / "assets" / "images" / "1"
    for n in build(dst):
        print("escrito", dst / n)
