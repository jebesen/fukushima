# Curso «El accidente nuclear de Fukushima»

Curso abierto en español (UNED) como **web estática instalable (PWA)**: HTML, CSS y JavaScript sin dependencias ni paso
de compilación. Se publica tal cual en GitHub Pages.

- Enrutado por *hash* (`#/3/3`): no necesita configuración del servidor.
- Responsive, modo claro/oscuro, buscador (Ctrl+K o «/»), progreso guardado en el dispositivo y barra de navegación en móvil.
- **Instalable** y con funcionamiento sin conexión para la interfaz y todos los textos; las imágenes se guardan al visitarlas.
  Los vídeos de YouTube requieren conexión.

## Estructura

```
index.html            estructura de la página, iconos y cuadros de diálogo
css/app.css           estilos
js/app.js             aplicación (enrutado, tests, búsqueda, navegación, comentarios, estadísticas)
js/config.js          ajustes: fecha de actualización, contador de visitas y formulario de comentarios
js/tsunami.js         animación del tsunami (apartado 2.4)
sw.js                 caché y funcionamiento sin conexión
manifest.webmanifest  datos de la aplicación instalable
data/course.json      estructura del curso: unidades, apartados y contenidos «¡Profundiza!»
data/search.json      índice del buscador (se reconstruye con tools/rebuild_search.py)
content/<u>/<l>.html  texto de cada apartado        content/<u>/auto.json  test de cada unidad
assets/images/        imágenes
tools/                utilidades (ver más abajo)
```

## Cómo se edita el curso

El contenido se edita **directamente** en estos ficheros; no hay ningún paso de generación.

| Qué quieres cambiar | Dónde |
|---|---|
| Texto de un apartado | `content/<unidad>/<apartado>.html` (HTML sencillo: `<p>`, `<h2 class="sec">`, `<figure>`…) |
| Preguntas de un test | `content/<unidad>/auto.json` (`correct: true` marca la respuesta correcta) |
| Títulos o índice del curso | `data/course.json` |
| Imágenes | `assets/images/<unidad>/` y la etiqueta `<img>` correspondiente |
| Fecha de la portada, contador, formulario | `js/config.js` |

Después de cambiar texto o tests, reconstruye el índice del buscador:

```bash
python tools/rebuild_search.py
```

## Probar en local

```bash
python -m http.server 8080
# abre http://localhost:8080
```

El service worker solo funciona en `localhost` o con HTTPS. No abras `index.html` con doble clic: el navegador bloquea así los módulos.

## Publicar cambios (GitHub Pages)

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Y **sube el número de `VERSION` en `sw.js`** (`'v9'` → `'v10'`…) cada vez que publiques cambios: los móviles con la app instalada
verán el aviso «Hay una nueva versión del curso» y actualizarán con un toque. Si no cambia `VERSION`, pueden seguir viendo la versión anterior.

Para ver tu comentario en la hoja o las visitas, no hay que hacer nada más (ver el apartado siguiente).

## Contador de visitas y formulario de comentarios

Todo se configura en `js/config.js`. Deja un valor en blanco para desactivar esa función.

**Contador de visitas (GoatCounter, sin cookies).** Cuenta `jebesen`; panel privado en `https://jebesen.goatcounter.com`.
Cada página que se abre dentro de la app se cuenta a mano, porque la web es de una sola página. El contador público del pie
necesita tener activado *Settings → Site → «Allow adding visitor counts on your website»*; si no, simplemente no se muestra.
Las visitas desde `localhost` no se cuentan y los bloqueadores de anuncios pueden impedir la medición.

**Comentarios (Google Forms → hoja de Drive).** El cuadro de comentarios es propio de la web y envía a un formulario de Google
con tres preguntas: valoración (escala 1-10), comentarios y correo. En `feedback` están la dirección de envío (`…/formResponse`) y el
identificador `entry.NNN` de cada pregunta. Si cambias las preguntas del formulario (o creas otro), hay que actualizar esos
identificadores: se obtienen con el menú ⋮ del formulario → «Obtener enlace rellenado previamente».
La página desde la que se escribe se añade al final del comentario. Google no devuelve confirmación al navegador, así que la web da
el envío por bueno si no hay error de red: la comprobación real es ver la respuesta en la hoja.

## Utilidades (`tools/`)

- `rebuild_search.py`: reconstruye el índice del buscador. **Es la única que se usa de forma habitual.**
- `selftest.js`: autocomprobación; se pega en la consola del navegador (F12) con la web abierta y revisa páginas, imágenes,
  enlaces y tests.
- `find_unused.py`: lista (y, con `--delete`, borra) las imágenes que ya no usa ninguna página.
- `make_charts.py`: dibuja las gráficas SVG del apartado 1.1 (`assets/images/1/fig*.svg`) a partir de las cifras que contiene.
- `migrate.py` y la carpeta `overrides/`: restos de la migración desde la antigua aplicación de App Engine. **No los ejecutes:**
  regenerarían el contenido y pisarían las ediciones hechas directamente. Se pueden borrar.

## Licencia

Contenidos © 2016 Dpto. de Ingeniería Energética, UNED, bajo licencia Creative Commons (ver pie de página).
Algunas imágenes indican en su pie que quedan fuera de esa licencia.
