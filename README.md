# Curso «El accidente nuclear de Fukushima» (versión estática / PWA)

Reescritura de la antigua aplicación de Google App Engine (`fukushima/`) como sitio **100 % estático**:
HTML + CSS + JavaScript sin dependencias ni paso de compilación. Se puede alojar en GitHub Pages,
Netlify, un bucket, o cualquier servidor de ficheros.

- Enrutado por *hash* (`#/3/3`): no necesita configuración del servidor ni funciona distinto en subcarpetas.
- Responsive, modo claro/oscuro, buscador (Ctrl+K o «/»), progreso guardado en el dispositivo.
- **Instalable** (PWA): manifest + service worker. Funciona sin conexión para la interfaz y todo el texto;
  las imágenes se guardan al visitarlos. Los vídeos de YouTube requieren conexión. El curso no ofrece descargas en PDF.

## 1. Generar el contenido (una sola vez)

Los textos del curso se migran automáticamente desde las plantillas Jinja de `../fukushima`.

```bash
pip install beautifulsoup4 html5lib pillow
python tools/migrate.py
# opcional: python tools/migrate.py --spellcheck   (pip install pyspellchecker)
```

Esto crea `content/`, `data/`, `assets/` e `icons/` y un informe **`CAMBIOS.md`** con:
erratas corregidas, enlaces arreglados, rutas con mayúsculas corregidas, recursos que faltan, incidencias
en los tests y todo lo que conviene revisar a mano. **Léelo antes de publicar.**

Puedes repetir el comando cuando quieras: regenera todo lo migrado (no toca `index.html`, `css/`, `js/`, `sw.js`).

## Contenido actualizado a mano (`overrides/`)

Si una lección necesita datos más recientes que los de la web original, se escribe su versión nueva en
`overrides/content/<unidad>/<lección>.html` (por ejemplo `overrides/content/1/1.html`). Al ejecutar `migrate.py`
esa versión **sustituye** a la que saldría de la plantilla original, así que no se pierde al regenerar.

Las gráficas del apartado 1.1 las dibuja `tools/make_charts.py` (SVG, sin dependencias). Las cifras están en ese
fichero, con su fuente y fecha, para revisarlas y actualizarlas: edita los datos y vuelve a ejecutar `migrate.py`.

Otras dos formas de actualizar sin perder los cambios al regenerar:

- `overrides/patches/<unidad>/<lección>.json`: **actualización integrada en el texto**. Cada parche sustituye (`replace`/`with`) o
  amplía (`after`/`insert`) una frase concreta de la lección migrada, de modo que los datos nuevos quedan dentro del propio texto
  (es lo que se usa en las unidades 2, 4, 5 y 6). Si una frase no se encuentra o aparece varias veces, el parche no se aplica y
  `CAMBIOS.md` lo avisa («PARCHE NO APLICADO»).
- `overrides/quiz/<unidad>.json`: corrige preguntas concretas de un test (`n` = número de pregunta, opciones numeradas desde 1).

La fecha que aparece en la esquina de la portada («Actualizado en septiembre de 2026») está en la constante
`COURSE_UPDATED` de `js/app.js`: cámbiala cuando vuelvas a revisar los datos.

## 2. Probar en local

```bash
python -m http.server 8080
# abre http://localhost:8080
```

(El service worker solo funciona en `localhost` o HTTPS.)

## 3. Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a un repositorio (sin `tools/` si no lo quieres; no hace falta para publicar).
2. *Settings → Pages → Deploy from a branch → `main` / `(root)`*.
3. Abre `https://<usuario>.github.io/<repo>/` desde el móvil: el navegador ofrecerá **Instalar** / *Añadir a pantalla de inicio*.

## 4. Actualizaciones

Cada vez que publiques cambios, **sube el número de `VERSION` en `sw.js`** (`v1` → `v2`). Los móviles con la app
instalada verán el aviso «Hay una nueva versión del curso» y actualizarán con un toque.

## Estructura

```
index.html            estructura, iconos SVG y diálogos
css/app.css           estilos (tema claro/oscuro, timeline, quiz…)
js/app.js             enrutado, vistas, tests, búsqueda, popovers, instalación
js/tsunami.js         animación SVG del tsunami (sustituye a la infografía Flash de 2.4)
sw.js                 caché y funcionamiento sin conexión
manifest.webmanifest  datos de la aplicación instalable
data/course.json      estructura del curso (unidades y lecciones)
data/search.json      índice del buscador
content/<u>/<l>.html  texto de cada lección       content/<u>/auto.json  test de la unidad
assets/               imágenes
tools/migrate.py      migración desde ../fukushima
tools/make_charts.py  gráficas SVG del apartado 1.1 (datos 2025-2026)
overrides/            versiones actualizadas a mano de lecciones (sustituyen a la migración)
```

## Licencia

Contenidos © 2016 Dpto. de Ingeniería Energética, UNED, bajo licencia Creative Commons (ver pie de página).
Algunas imágenes indican en su pie que quedan fuera de esa licencia.
