/* Curso «El accidente nuclear de Fukushima» — aplicación estática (sin backend).
   Enrutado por hash (#/unidad/lección) para funcionar en GitHub Pages sin configuración. */

import { CONFIG } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const SITE = 'Fukushima · OCW UNED';
const COURSE_UPDATED = CONFIG.updated; // se muestra en la portada; se cambia en js/config.js

const store = {
  get(k, d) { try { const v = localStorage.getItem('fuku:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fuku:' + k, JSON.stringify(v)); } catch { /* modo privado */ } },
};

let course, flat = [], routeId = 0, quoteTimer = null, cleanups = [];
let progress = store.get('progress', { visited: {}, quiz: {}, last: null });
const saveProgress = () => store.set('progress', progress);
const main = $('#main');

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */
async function init() {
  setupChrome();
  initTracking();
  loadVisits();
  try {
    course = await (await fetch('data/course.json')).json();
  } catch {
    main.innerHTML = `<div class="aviso">No se pudo cargar el curso. Comprueba la conexión y recarga la página.</div>`;
    return;
  }
  course.units.forEach((u) => u.lessons.forEach((l) => flat.push({ u: u.id, l: l.id, title: l.title, type: l.type, unit: u })));
  renderSidebar();
  addEventListener('hashchange', route);
  route();
  registerSW();
}

/* ------------------------------------------------------------------ */
/* Enrutado                                                            */
/* ------------------------------------------------------------------ */
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  return { parts: raw.split('?')[0].split('/').filter(Boolean) };
}

async function route() {
  const my = ++routeId;
  closePop(); closeNav(); clearInterval(quoteTimer);
  cleanups.forEach((fn) => { try { fn(); } catch { /* ya desmontado */ } });
  cleanups = [];
  const { parts } = parseRoute();
  let view;
  try {
    if (!parts.length) view = renderHome();
    else if (parts[0] === 'creditos') view = renderCredits();
    else if (parts.length === 2) view = await renderLesson(parts[0], parts[1], my);
    else view = notFound();
  } catch (e) {
    console.error(e);
    view = errorView();
  }
  if (!view || my !== routeId) return; // llegó otra navegación mientras cargaba
  document.title = view.title ? `${view.title} · ${SITE}` : SITE;
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
  if (view.visited) markVisited(view.visited, view.isExtra);
  updateSidebar();
  setMobileBar(view.nav);
  track(parts.length ? '/' + parts.join('/') : '/', document.title);
  onScroll();
}

function markVisited(key, isExtra) {
  progress.visited[key] = Date.now();
  if (!isExtra) progress.last = key;
  saveProgress();
}

/* ------------------------------------------------------------------ */
/* Vistas                                                              */
/* ------------------------------------------------------------------ */
const QUOTES = [
  ['Esto no es, y nunca será, Chernobyl bajo ninguna circunstancia imaginable.', 'Lisbeth Gronlund', 'Union of Concerned Scientists'],
  ['El enorme programa de descontaminación del Gobierno japonés apenas tendrá efecto en la reducción de la amenaza ambiental que supone la enorme cantidad de radiación emitida por la central.', 'Kendra Ulrich', 'NGO Nuclear Campaigner'],
  ['Comparado con el impacto masivo en muertes y destrucción del terremoto y el tsunami, no creo que el accidente nuclear vaya a tener demasiado impacto.', 'Greg Evans', 'Universidad de Toronto'],
  ['Entiendo el miedo de la población, pero es muy difícil luchar contra el cambio climático, casi imposible, sin el uso de la energía nuclear.', 'Nobuo Tanaka', 'International Energy Agency'],
  ['La administración está comprometida a aprender de la experiencia japonesa mientras trabajamos en fortalecer la industria nuclear americana.', 'Steven Chu', 'Secretaría de Energía. EEUU'],
];

function quoteHTML([t, n, c]) {
  return `<p>${esc(t)}</p><footer>${esc(n)} <cite>(${esc(c)})</cite></footer>`;
}

function renderHome() {
  const last = progress.last && flat.find((x) => `${x.u}/${x.l}` === progress.last);
  const cta = last
    ? `<a class="btn" href="#/${last.u}/${last.l}">${ico('play')} Continuar: ${esc(last.title)}</a><a class="btn ghost" href="#/1/Intro">Empezar desde el principio</a>`
    : `<a class="btn" href="#/1/Intro">${ico('play')} Empezar el curso</a>`;
  const units = course.units.map((u) => {
    const done = u.lessons.filter((l) => progress.visited[`${u.id}/${l.id}`]).length;
    const pct = Math.round((done / u.lessons.length) * 100);
    return `<article class="unit-card">
      <h3><span class="un">${u.id}</span><a href="#/${u.id}/Intro">${esc(u.title)}</a></h3>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
      <div class="bar-l">${done} de ${u.lessons.length} apartados</div>
      <ul>${u.lessons.map((l) => `<li><a href="#/${u.id}/${l.id}">${esc(l.title)}</a></li>`).join('')}</ul>
    </article>`;
  }).join('');
  main.innerHTML = `
  <section class="hero">
    <span class="hero-date" title="Fecha de la última actualización de los datos del curso">${ico('calendar')} Actualizado en ${COURSE_UPDATED}</span>
    <p class="kicker">OpenCourseWare · UNED</p>
    <h1>El accidente nuclear de Fukushima</h1>
    <p class="lead">Un curso abierto en español, apto para cualquier nivel formativo, sobre lo que ocurrió el 11 de marzo de 2011 en la central de Fukushima Dai-ichi, por qué ocurrió y qué hemos aprendido.</p>
    <div class="cta">${cta}</div>
  </section>

  <div class="video"><iframe src="https://www.youtube.com/embed/b_23Ng5v1uU?rel=0" title="Vídeo de presentación del curso" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
  <details class="fuentes"><summary>Fuentes del vídeo</summary>
    <h4>Fotografías</h4>
    <ul>${['after5', 'after4', 'after7', 'after2', 'after', 'after6'].map((n) => `<li>${n}: Jun Teramoto · CC BY-SA 2.0 (<a href="https://www.flickr.com/photos/jun_teramoto/5634754502/in/album-72157626531816316/" target="_blank" rel="noopener noreferrer">Flickr</a>)</li>`).join('')}</ul>
    <h4>Vídeos</h4>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=T-XeMIHNikg" target="_blank" rel="noopener noreferrer">Terremoto y Tsunami de Japón 2011 [IGEO.TV]</a></li>
      <li><a href="https://vimeo.com/21538681" target="_blank" rel="noopener noreferrer">Arnie Gundersen on Rachel Maddow – Discusses the Fukushima Radiation Plume</a></li>
      <li><a href="https://vimeo.com/45317462" target="_blank" rel="noopener noreferrer">As Japan Says Fukushima Daiichi Disaster Man-Made &amp; Preventable Fears Grow for Nuclear Plants Worldwide</a></li>
      <li><a href="https://www.youtube.com/watch?v=w3AdFjklR50" target="_blank" rel="noopener noreferrer">Japan Earthquake – Helicopter aerial view video of giant tsunami waves</a></li>
      <li>Japan Earthquake [near Fukushima] &amp; Tsunami Advisory [recorded live] – NHK World (12/07/2014)</li>
      <li>Japan Fukushima Second Nuclear Reactor Explosion From 9.0 Earthquake</li>
    </ul>
    <h4>Música</h4>
    <ul>
      <li><a href="https://musicalibre.es/netjuke/search.php?do=list.tracks&col=ar.id&val=434&sort=ar" target="_blank" rel="noopener noreferrer">Fin del reino: S. Salazar. Sin derechos.</a></li>
      <li><a href="https://freemusicarchive.org/music/Ian_Alex_Mac/Cues_Additional/The_Tragedy_of_Loss" target="_blank" rel="noopener noreferrer">The tragedy of loss: Ian Alex Mac. Creative Commons.</a></li>
    </ul>
  </details>

  <div class="feat">
    <div><img src="assets/images/iconos/icon1.png" alt="" loading="lazy"><h3>Material de lectura</h3><p>Textos de lectura acompañados de imágenes que recogen los contenidos generales de cada unidad temática.</p></div>
    <div><img src="assets/images/iconos/icon2.png" alt="" loading="lazy"><h3>Microvídeos</h3><p>Vídeos cortos que abordan de forma clara y didáctica aspectos concretos de cada unidad. Sigue tu propio ritmo: repite, detén y reflexiona.</p></div>
    <div><img src="assets/images/iconos/icon3.png" alt="" loading="lazy"><h3>Seguimiento y evaluación</h3><p>Cada unidad termina con un test de corrección automática para que compruebes tu progreso.</p></div>
  </div>

  <blockquote class="quote" id="cita">${quoteHTML(QUOTES[0])}</blockquote>

  <section class="card-wrap">
    <h2>Accidente nuclear de Fukushima Dai-ichi</h2>
    <p>El accidente nuclear de Fukushima I (福島第一原子力発電所事故, Fukushima Daiichi Genshiryoku Hatsudensho jiko), ocurrido en la central nuclear Fukushima I el 11 de marzo de 2011, comprende una serie de incidentes, tales como las explosiones en los edificios que albergan los reactores nucleares, fallos en los sistemas de refrigeración, la fusión del núcleo en tres de los reactores y la liberación de radiación al exterior, registrados como consecuencia de los desperfectos ocasionados por el terremoto y el tsunami de Japón oriental.</p>
    <h2>Duración</h2>
    <p>El curso se propone con una duración de 6 semanas (1 semana para cada unidad didáctica), pero debido a la disponibilidad y al carácter abierto del curso cada estudiante puede decidir realizarlo a su propio ritmo.</p>
    <h2>¿Por qué hacer este curso?</h2>
    <p>Un accidente de estas características tiene gran repercusión en la opinión pública y en los medios de comunicación, pero rara vez la información en los medios es precisa y en demasiadas ocasiones se encuentra polarizada. Existe un abismo entre lo que es familiar para los especialistas nucleares y el conocimiento de la población. Asimismo, existe también una gran desinformación general al respecto. Todo ello sustenta una fobia nuclear generalizada que se mantiene desde las últimas décadas.</p>
    <p>Por ello cada vez es más importante la diseminación de conocimiento en el ámbito nuclear con carácter generalista, para combatir el miedo hacia lo nuclear y la creencia de que lo nuclear es demasiado complejo para ser entendido por personas sin conocimientos técnicos o específicos.</p>
    <p>El objetivo del curso es acercar al público general la información más relevante sobre el accidente, sus consecuencias y las medidas adoptadas por los distintos países. Se proporcionará un contexto al accidente, explicando cada una de sus fases, la reacción internacional, las medidas tomadas así como las lecciones aprendidas.</p>
    <h2>Prerrequisitos</h2>
    <p>No se requiere ningún requisito previo. El curso puede ser seguido por personas con cualquier nivel formativo si bien, adicionalmente, se ofrece la posibilidad de profundizar en ciertos conceptos y temáticas de forma que resulte igualmente interesante a usuarios con formación técnica o específica.</p>
    <p>A lo largo del curso encontrarás el botón <span class="btn extra">${ico('search')} ¡Profundiza!</span>. Al pulsarlo accederás a contenido más técnico que te permitirá profundizar en ciertos temas. Ese contenido no es evaluable y su estudio es voluntario.</p>
    <h2>Instálalo en tu móvil</h2>
    <p>Puedes instalar el curso como aplicación (botón «Instalar» de la cabecera o «Añadir a pantalla de inicio»). Los textos que hayas abierto quedan disponibles sin conexión.</p>
  </section>

  <h2>Contenido del curso</h2>
  <div class="units">${units}</div>
  <p class="reset-row"><button type="button" class="btn sec small" data-reset>Borrar mi progreso</button></p>`;

  let i = 0;
  const box = $('#cita');
  quoteTimer = setInterval(() => {
    i = (i + 1) % QUOTES.length;
    box.classList.add('fade');
    setTimeout(() => { box.innerHTML = quoteHTML(QUOTES[i]); box.classList.remove('fade'); }, 600);
  }, 8000);
  return { title: null };
}

function renderCredits() {
  main.innerHTML = `
  <article class="lesson"><h1>El equipo</h1></article>
  <div class="team">
    <figure><img src="assets/images/equipo/jesus.jpg" alt="Jesús Benavent" loading="lazy"><figcaption><b>Jesús Benavent Sendra</b><span>Ingeniero Industrial</span><br><a href="https://es.linkedin.com/in/jesusbenavent" target="_blank" rel="noopener noreferrer">${ico('linkedin')} LinkedIn</a></figcaption></figure>
    <figure><img src="assets/images/equipo/mercedes.jpg" alt="Mercedes Alonso" loading="lazy"><figcaption><b>Mercedes Alonso Ramos</b><span>Ingeniero Industrial. Profesora en la UNED.</span><br><a href="https://es.linkedin.com/in/mercedes-alonso-ramos-7418bb18" target="_blank" rel="noopener noreferrer">${ico('linkedin')} LinkedIn</a></figcaption></figure>
  </div>
  <section class="card-wrap">
    <h2>Agradecimientos y colaboraciones</h2>
    <ul>
      <li><a href="https://www.iaea.org/" target="_blank" rel="noopener noreferrer">IAEA</a></li>
      <li><a href="https://www.foronuclear.org" target="_blank" rel="noopener noreferrer">Foro Nuclear</a></li>
      <li><a href="https://www.jovenesnucleares.org/" target="_blank" rel="noopener noreferrer">Jóvenes Nucleares</a></li>
      <li><a href="https://www.tecnatom.es/" target="_blank" rel="noopener noreferrer">TECNATOM</a></li>
      <li><a href="https://www.lapizarradeyuri.com/" target="_blank" rel="noopener noreferrer">La Pizarra de Yuri</a></li>
      <li>Ángeles Sánchez Elvira. Facultad de Psicología. UNED.</li>
      <li>Manuel Castro. Dpto. Ingeniería Eléctrica, Electrónica y de Control. ETSII. UNED.</li>
      <li>Javier Sanz. Dpto. Ingeniería Energética. ETSII. UNED.</li>
      <li>Francisco Barea. Dpto. Ingeniería Energética. ETSII. UNED.</li>
    </ul>
  </section>`;
  return { title: 'El equipo' };
}

const notFound = () => {
  main.innerHTML = `<article class="lesson"><h1>Página no encontrada</h1><p>Esa dirección no existe en el curso.</p><a class="btn" href="#/">Volver al inicio</a></article>`;
  return { title: 'No encontrada' };
};
const errorView = () => {
  main.innerHTML = `<article class="lesson"><h1>No se pudo cargar</h1><div class="aviso">Este contenido aún no se ha guardado en el dispositivo y ahora mismo no hay conexión. Vuelve a intentarlo cuando estés en línea.</div><a class="btn" href="#/">Volver al inicio</a></article>`;
  return { title: 'Sin conexión' };
};

function eyebrow(unit, isExtra) {
  return isExtra ? 'Contenido extra · voluntario y no evaluable'
    : `<a href="#/${unit.id}/Intro">Unidad ${unit.id}</a> · ${esc(unit.title)}`;
}

function pager(unit, lid, isExtra, meta) {
  if (isExtra) {
    const parent = meta.parent && unit.lessons.find((l) => l.id === meta.parent);
    const to = parent ? `#/${unit.id}/${parent.id}` : `#/${unit.id}/Intro`;
    return `<nav class="pager" aria-label="Navegación"><a class="prev" href="${to}"><small>Volver</small><span>${ico('chevron-left')} ${esc(parent ? parent.title : 'Introducción')}</span></a></nav>`;
  }
  const i = flat.findIndex((x) => x.u === unit.id && x.l === lid);
  const p = flat[i - 1], n = flat[i + 1];
  const label = (x) => (x.u !== unit.id ? `Unidad ${x.u}: ` : '') + x.title;
  return `<nav class="pager" aria-label="Navegación">
    ${p ? `<a class="prev" href="#/${p.u}/${p.l}"><small>Anterior</small><span>${ico('chevron-left')} ${esc(label(p))}</span></a>` : '<span></span>'}
    ${n ? `<a class="next" href="#/${n.u}/${n.l}"><small>Siguiente</small><span>${esc(label(n))} ${ico('chevron-right')}</span></a>` : ''}
  </nav>`;
}

/* Barra inferior fija (móvil y tablet): anterior / índice / siguiente */
function navFor(unit, lid, isExtra, meta) {
  if (isExtra) {
    const parent = (meta.parent && unit.lessons.find((l) => l.id === meta.parent)) || unit.lessons[0];
    return { prev: { href: `#/${unit.id}/${parent.id}`, title: parent.title, label: 'Volver' }, next: null };
  }
  const i = flat.findIndex((x) => x.u === unit.id && x.l === lid);
  const p = flat[i - 1], n = flat[i + 1];
  const item = (x, label) => (x ? { href: `#/${x.u}/${x.l}`, title: (x.u !== unit.id ? `U${x.u} · ` : '') + x.title, label } : null);
  return { prev: item(p, 'Anterior'), next: item(n, 'Siguiente') };
}

function setMobileBar(nav) {
  const bar = $('#mbar');
  document.body.classList.toggle('has-mbar', !!nav);
  bar.hidden = !nav;
  if (!nav) return;
  const set = (sel, item, label) => {
    const a = $(sel);
    $('small', a).textContent = item ? item.label : label;
    $('b', a).textContent = item ? item.title : '';
    if (item) { a.href = item.href; a.title = item.title; a.setAttribute('aria-disabled', 'false'); a.removeAttribute('tabindex'); }
    else { a.removeAttribute('href'); a.removeAttribute('title'); a.setAttribute('aria-disabled', 'true'); a.tabIndex = -1; }
  };
  set('#mb-prev', nav.prev, 'Anterior');
  set('#mb-next', nav.next, 'Siguiente');
}

async function renderLesson(uid, lid, my) {
  const unit = course.units.find((x) => x.id === uid);
  const inLessons = unit && unit.lessons.find((x) => x.id === lid);
  const meta = inLessons || (unit && unit.extras.find((x) => x.id === lid));
  if (!meta) return notFound();
  const isExtra = !inLessons;
  if (meta.type === 'quiz') return renderQuiz(unit, meta, my);

  main.innerHTML = '<p class="loading">Cargando…</p>';
  const res = await fetch(`content/${uid}/${lid}.html`);
  if (my !== routeId) return null;
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let html = await res.text();
  if (my !== routeId) return null;

  if (meta.type === 'intro') {
    html += `<h2 class="sec">Capítulos</h2><ol class="chapters">${unit.lessons.filter((l) => l.id !== 'Intro').map((l) =>
      `<li><a href="#/${uid}/${l.id}"><span class="n">${l.type === 'quiz' ? ico('check') : esc(l.title.split(' ')[0])}</span><span>${esc(l.type === 'quiz' ? 'Cuestionario de autoevaluación' : l.title.replace(/^[\d.]+\s*/, ''))}</span></a></li>`).join('')}</ol>`;
  }
  main.innerHTML = `<article class="lesson">
    <p class="eyebrow">${eyebrow(unit, isExtra)}</p>
    <h1>${esc(meta.title)}</h1>
    <div class="prose">${html}</div>
    ${pager(unit, lid, isExtra, meta)}
  </article>`;

  // índice "En esta página"
  const prose = $('.prose', main);
  const heads = $$('h2.sec', prose);
  if (heads.length >= 3) {
    heads.forEach((h, i) => { h.id = 's' + i; });
    const toc = document.createElement('details');
    toc.className = 'toc';
    toc.innerHTML = `<summary>En esta página</summary><ol>${heads.map((h) => `<li><a href="#${h.id}">${esc(h.textContent)}</a></li>`).join('')}</ol>`;
    prose.before(toc);
  }
  // animaciones interactivas incrustadas (sustituyen a las antiguas infografías Flash)
  $$('.anim[data-anim="tsunami"]', prose).forEach((el) => {
    import('./tsunami.js').then((m) => { if (my === routeId) cleanups.push(m.mountTsunami(el)); })
      .catch(() => { el.innerHTML = '<div class="aviso">No se pudo cargar la animación. Comprueba la conexión.</div>'; });
  });
  return { title: meta.title, visited: `${uid}/${lid}`, isExtra, nav: navFor(unit, lid, isExtra, meta) };
}

/* ------------------------------------------------------------------ */
/* Autoevaluación                                                      */
/* ------------------------------------------------------------------ */
async function renderQuiz(unit, meta, my) {
  main.innerHTML = '<p class="loading">Cargando…</p>';
  const res = await fetch(`content/${unit.id}/auto.json`);
  if (my !== routeId) return null;
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (my !== routeId) return null;
  const best = progress.quiz[unit.id];

  main.innerHTML = `<article class="lesson">
    <p class="eyebrow">${eyebrow(unit, false)}</p>
    <h1>${esc(meta.title)}</h1>
    <p class="muted">Responde a las preguntas y pulsa «Evaluar». Puedes repetir el test todas las veces que quieras.${best ? ` Tu mejor resultado: <b>${best.best}/${best.total}</b>.` : ''}</p>
    <form class="quiz" novalidate>
      <div class="res" id="res" hidden></div>
      ${data.questions.map(questionHTML).join('')}
      <div class="actions">
        <button class="btn" type="submit" id="go">Evaluar</button>
        <button class="btn sec" type="button" id="retry" hidden>Repetir el test</button>
      </div>
    </form>
    ${pager(unit, meta.id, false, meta)}
  </article>`;

  const form = $('.quiz', main);
  form.addEventListener('submit', (e) => { e.preventDefault(); evaluate(form, data, unit); });
  $('#retry', form).addEventListener('click', () => { route(); });
  return { title: meta.title, visited: `${unit.id}/auto`, nav: navFor(unit, meta.id, false, meta) };
}

function questionHTML(q, i) {
  return `<fieldset class="q" data-i="${i}">
    <legend><span class="n">${q.n}</span>${esc(q.text)}</legend>
    ${q.multiple ? '<p class="hint">Marca todas las opciones correctas.</p>' : ''}
    ${q.image ? `<img class="qimg" src="${q.image}" alt="Imagen de la pregunta ${q.n}" loading="lazy">` : ''}
    ${q.options.map((o, j) => `<label class="opt"><input type="${q.multiple ? 'checkbox' : 'radio'}" name="q${i}" value="${j}"><span class="t">${o.text}</span><span class="mark" aria-hidden="true"></span></label>`).join('')}
    <div class="why" hidden></div>
  </fieldset>`;
}

function evaluate(form, data, unit) {
  let score = 0, unanswered = 0;
  data.questions.forEach((q, i) => {
    const fs = $(`.q[data-i="${i}"]`, form);
    const chosen = $$('input:checked', fs).map((x) => +x.value);
    if (!chosen.length) unanswered++;
    const right = q.options.map((o, j) => (o.correct ? j : -1)).filter((j) => j >= 0);
    if (chosen.length === right.length && right.every((j) => chosen.includes(j))) score++;
    fs.classList.add('done');
    $$('.opt', fs).forEach((lab, j) => {
      const isRight = q.options[j].correct, isChosen = chosen.includes(j);
      lab.classList.toggle('ok', isRight && isChosen);
      lab.classList.toggle('bad', !isRight && isChosen);
      lab.classList.toggle('miss', isRight && !isChosen);
      $('.mark', lab).innerHTML = ico(isRight ? 'check' : 'x');
      $('input', lab).disabled = true;
    });
    const why = $('.why', fs);
    const txt = q.options.map((o) => o.why).filter(Boolean).join(' ');
    if (txt) { why.innerHTML = txt; why.hidden = false; }
  });
  const total = data.questions.length, pct = Math.round((score / total) * 100);
  const msg = pct >= 80 ? '¡Muy bien! Dominas los contenidos de esta unidad.'
    : pct >= 50 ? 'Vas por buen camino. Repasa las preguntas falladas.'
    : 'Te recomendamos repasar la unidad y volver a intentarlo.';
  const res = $('#res', form);
  res.hidden = false;
  res.innerHTML = `<b>Has acertado ${score} de ${total} preguntas</b> (${pct} %)<div class="bar"><i style="width:${pct}%"></i></div>${msg}${unanswered ? ` <span>(${unanswered} sin responder)</span>` : ''}`;
  $('#go', form).hidden = true;
  $('#retry', form).hidden = false;
  const prev = progress.quiz[unit.id];
  progress.quiz[unit.id] = { best: Math.max(score, prev ? prev.best : 0), total, last: score, at: Date.now() };
  saveProgress();
  updateSidebar();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
/* Índice lateral                                                      */
/* ------------------------------------------------------------------ */
function renderSidebar() {
  $('#side').innerHTML = `<nav>
    <a class="top-link" href="#/">${ico('home')} Inicio</a>
    ${course.units.map((u) => `<details data-u="${u.id}"><summary><span class="un">${u.id}</span><span>${esc(u.title)}</span></summary>
      <ol>${u.lessons.map((l) => `<li><a href="#/${u.id}/${l.id}" data-k="${u.id}/${l.id}"><span>${esc(l.title)}</span><span class="slot tick"></span></a></li>`).join('')}</ol></details>`).join('')}
    <a class="top-link" href="#/creditos">Equipo</a>
    <div class="side-foot">
      <p class="muted" id="prog-count"></p>
      <button type="button" class="btn sec small" data-feedback${fbOn() ? '' : ' hidden'}>Enviar comentarios</button>
      <button type="button" class="btn sec small" data-reset>Borrar mi progreso</button>
    </div>
  </nav>`;
}

function updateSidebar() {
  const keys = flat.map((x) => `${x.u}/${x.l}`);
  const seen = keys.filter((k) => progress.visited[k]).length;
  const pc = $('#prog-count');
  if (pc) pc.textContent = `${seen} de ${keys.length} apartados vistos`;
  const { parts } = parseRoute();
  let cur = parts.length === 2 ? parts.join('/') : null;
  if (cur) { // los contenidos extra resaltan su lección de origen
    const u = course.units.find((x) => x.id === parts[0]);
    const ex = u && u.extras.find((x) => x.id === parts[1]);
    if (ex && ex.parent) cur = `${parts[0]}/${ex.parent}`;
  }
  $$('#side a[data-k]').forEach((a) => {
    const k = a.dataset.k;
    a.classList.toggle('cur', k === cur);
    a.classList.toggle('done', !!progress.visited[k]);
    if (k === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    const q = k.endsWith('/auto') ? progress.quiz[k.split('/')[0]] : null;
    const slot = $('.slot', a);
    slot.className = 'slot ' + (q ? 'score' : 'tick');
    slot.textContent = q ? `${q.best}/${q.total}` : '';
  });
  const openU = cur ? cur.split('/')[0] : null;
  $$('#side details').forEach((d) => { if (d.dataset.u === openU) d.open = true; });
  const c = $('#side a.cur');
  if (c && matchMedia('(min-width:1000px)').matches) c.scrollIntoView({ block: 'nearest' });
}

const openNav = () => { document.body.classList.add('nav-open'); $('#btn-menu').setAttribute('aria-expanded', 'true'); };
function closeNav() { document.body.classList.remove('nav-open'); $('#btn-menu').setAttribute('aria-expanded', 'false'); }

/* ------------------------------------------------------------------ */
/* Ventanas emergentes de términos, imágenes y búsqueda                */
/* ------------------------------------------------------------------ */
let termSeq = 0;
function closePop() { const p = $('#pop'); p.hidden = true; delete p.dataset.for; }
function positionPop(btn, pop) {
  if (innerWidth <= 640) return;
  const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.min(Math.max(8, r.left + scrollX), document.documentElement.clientWidth - w - 8 + scrollX);
  const below = r.bottom + h + 16 <= innerHeight;
  pop.style.left = left + 'px';
  pop.style.top = (below ? r.bottom + scrollY + 8 : Math.max(scrollY + 8, r.top + scrollY - h - 8)) + 'px';
}
function openPop(btn) {
  const pop = $('#pop');
  if (!btn.dataset.id) btn.dataset.id = 't' + ++termSeq;
  if (!pop.hidden && pop.dataset.for === btn.dataset.id) return closePop();
  pop.innerHTML = `<button class="pclose" aria-label="Cerrar">${ico('x')}</button><h4></h4><div class="pb"></div>`;
  $('h4', pop).textContent = btn.dataset.title || '';
  const pb = $('.pb', pop);
  if (btn.dataset.html) pb.innerHTML = btn.dataset.content; else pb.textContent = btn.dataset.content;
  pop.dataset.for = btn.dataset.id;
  pop.hidden = false;
  positionPop(btn, pop);
  $$('img', pb).forEach((im) => im.addEventListener('load', () => positionPop(btn, pop)));
}

function openLightbox(img) {
  const d = $('#lightbox');
  $('img', d).src = img.currentSrc || img.src;
  $('img', d).alt = img.alt;
  const cap = img.closest('figure') && $('figcaption strong', img.closest('figure'));
  $('figcaption', d).textContent = cap ? cap.textContent : img.alt;
  d.showModal();
}

let searchIdx = null, searchTimer = null;
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
async function loadSearch() {
  if (!searchIdx) searchIdx = (await (await fetch('data/search.json')).json()).map((e) => ({ ...e, n: norm(e.t + ' ' + e.x) }));
  return searchIdx;
}
function highlight(text, terms) {
  const n = norm(text), marks = [];
  terms.forEach((t) => { let p = -1; while ((p = n.indexOf(t, p + 1)) >= 0) marks.push([p, p + t.length]); });
  marks.sort((a, b) => a[0] - b[0]);
  let out = '', last = 0;
  for (const [s, e] of marks) { if (s < last) continue; out += esc(text.slice(last, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>'; last = e; }
  return out + esc(text.slice(last));
}
async function doSearch(q) {
  const box = $('#s-res');
  const terms = norm(q).split(/\s+/).filter((t) => t.length >= 2);
  if (!terms.length) { box.innerHTML = '<p class="muted">Escribe al menos dos letras.</p>'; return; }
  let idx;
  try { idx = await loadSearch(); } catch { box.innerHTML = '<p class="muted">El buscador necesita conexión la primera vez.</p>'; return; }
  const hits = [];
  for (const e of idx) {
    if (!terms.every((t) => e.n.includes(t))) continue;
    const nt = norm(e.t);
    let score = 0;
    terms.forEach((t) => { if (nt.includes(t)) score += 20; let c = 0, p = -1; while ((p = e.n.indexOf(t, p + 1)) >= 0 && c < 50) c++; score += c; });
    hits.push({ e, score });
  }
  hits.sort((a, b) => b.score - a.score);
  if (!hits.length) { box.innerHTML = '<p class="muted">Sin resultados.</p>'; return; }
  box.innerHTML = hits.slice(0, 12).map(({ e }) => {
    const pos = Math.max(0, e.n.indexOf(terms[0]) - e.t.length - 1);
    const snip = e.x.slice(Math.max(0, pos - 60), pos + 150);
    const unit = course.units.find((u) => u.id === e.u);
    return `<a href="#/${e.u}/${e.l}"><b>${highlight(e.t, terms)}</b><small>Unidad ${e.u} · ${esc(unit ? unit.title : '')}</small><small>…${highlight(snip, terms)}…</small></a>`;
  }).join('');
}

/* ------------------------------------------------------------------ */
/* Tema, instalación, progreso de lectura y service worker              */
/* ------------------------------------------------------------------ */
function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function updateThemeBtn() {
  $('#btn-theme').innerHTML = ico(currentTheme() === 'dark' ? 'sun' : 'moon');
}

let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) $('button', t).onclick = action.fn;
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (!action) toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    $('#prog').style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    ticking = false;
  });
}

function resetProgress() {
  progress = { visited: {}, quiz: {}, last: null };
  saveProgress();
  toast('Progreso borrado.');
  if (location.hash && location.hash !== '#/' && location.hash !== '#') location.hash = '#/';
  else route();
}

function setupChrome() {
  updateThemeBtn();
  $('#btn-theme').onclick = () => {
    const t = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    store.set('theme', t);
    updateThemeBtn();
  };
  $('#btn-menu').onclick = () => (document.body.classList.contains('nav-open') ? closeNav() : openNav());
  $('#mb-menu').onclick = openNav;
  setupFeedback();
  $('#scrim').onclick = closeNav;
  $('#side').addEventListener('click', (e) => { if (e.target.closest('a')) closeNav(); });

  const dlg = $('#search'), q = $('#q');
  const openSearch = () => { dlg.showModal(); q.select(); };
  $('#btn-search').onclick = openSearch;
  q.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => doSearch(q.value), 120); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const a = $('#s-res a'); if (a) a.click(); } });
  $('#s-res').addEventListener('click', (e) => { if (e.target.closest('a')) dlg.close(); });
  $('#lightbox').addEventListener('click', () => $('#lightbox').close());
  const rst = $('#reset');
  rst.addEventListener('close', () => { if (rst.returnValue === 'ok') resetProgress(); });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) { const d = $('#reset'); d.returnValue = ''; d.showModal(); return; }
    const term = e.target.closest('.term');
    if (term) return openPop(term);
    if (e.target.closest('.pclose')) return closePop();
    if (!e.target.closest('#pop')) closePop();
    const img = e.target.closest('.prose figure img, .prose .timeline-body img');
    if (img) return openLightbox(img);
    const toc = e.target.closest('.toc a');
    if (toc) { e.preventDefault(); const t = document.getElementById(toc.getAttribute('href').slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePop(); closeNav(); }
    const typing = /^(input|textarea|select)$/i.test(document.activeElement.tagName);
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) { e.preventDefault(); openSearch(); }
  });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', closePop);
  addEventListener('offline', () => toast('Sin conexión: se muestran los contenidos ya guardados.'));
  addEventListener('online', () => toast('Conexión recuperada.'));

  const btn = $('#btn-install');
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; btn.hidden = standalone(); });
  addEventListener('appinstalled', () => { installEvt = null; btn.hidden = true; toast('¡Aplicación instalada!'); });
  if (isIOS() && !standalone()) btn.hidden = false;
  btn.onclick = async () => {
    if (installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; btn.hidden = true; }
    else if (isIOS()) $('#ios-hint').showModal();
  };
}

/* ------------------------------------------------------------------ */
/* Estadísticas de uso (GoatCounter, sin cookies) y formulario        */
/* ------------------------------------------------------------------ */
// El formulario solo se activa si hay dirección de envío y al menos los identificadores de la valoración y el comentario
const fbOn = () => {
  const f = CONFIG.feedback || {};
  return !!(f.action && f.fields && f.fields.rating && f.fields.comment);
};
let gcReady = false;
const gcQueue = [];

function initTracking() {
  if (!CONFIG.goatcounter) return;
  const note = $('#gc-note');
  if (note) note.hidden = false;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${CONFIG.goatcounter}.goatcounter.com/count`;
  s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true }); // las páginas se cuentan a mano (la web es de una sola página)
  s.onload = () => { gcReady = true; gcQueue.splice(0).forEach((h) => window.goatcounter.count(h)); };
  s.onerror = () => { gcQueue.length = 0; }; // bloqueador de anuncios o sin conexión: se ignora
  document.head.append(s);
}

function track(path, title) {
  if (!CONFIG.goatcounter) return;
  const hit = { path, title };
  if (gcReady && window.goatcounter && window.goatcounter.count) window.goatcounter.count(hit);
  else if (gcQueue.length < 20) gcQueue.push(hit);
}

async function loadVisits() {
  const el = $('#visits');
  if (!el || !CONFIG.goatcounter || !CONFIG.publicCounter) return;
  try {
    const r = await fetch(`https://${CONFIG.goatcounter}.goatcounter.com/counter/TOTAL.json`);
    if (!r.ok) throw new Error(String(r.status));
    const { count } = await r.json();
    $('b', el).textContent = count;
    el.hidden = false;
  } catch { el.hidden = true; } // sin conexión, bloqueado o contador público desactivado
}

function setupFeedback() {
  const fb = CONFIG.feedback || {};
  $$('[data-feedback]').forEach((el) => { el.hidden = !fbOn(); });
  if (!fbOn()) return;
  const dlg = $('#feedback'), form = $('form', dlg), done = $('.fb-done', dlg), msg = $('.fb-msg', dlg), send = $('button[type=submit]', form);
  const scores = $$('.sc', form);
  const say = (t, cls = '') => { msg.textContent = t; msg.className = 'fb-msg ' + cls; };
  const paint = () => scores.forEach((l) => l.classList.toggle('on', $('input', l).checked));
  scores.forEach((l) => $('input', l).addEventListener('change', paint));

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-feedback]')) {
      closeNav(); say(''); form.hidden = false; done.hidden = true; dlg.showModal();
    } else if (e.target.closest('[data-fb-close]')) dlg.close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const el = form.elements;
    if (el.website.value) return; // campo señuelo: solo lo rellenan los bots
    const rating = el.rating.value, comment = el.comment.value.trim(), email = el.email.value.trim();
    if (!rating && !comment) return say('Elige una valoración o escribe un comentario.', 'err');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return say('El correo no parece válido (puedes dejarlo en blanco).', 'err');
    if (!navigator.onLine) return say('Sin conexión: inténtalo de nuevo cuando estés en línea.', 'err');
    if (Date.now() - store.get('fbLast', 0) < 30000) return say('Espera unos segundos antes de enviar otro mensaje.', 'err');

    const page = location.hash.replace(/^#/, '') || '/';
    const data = new URLSearchParams();
    const put = (k, v) => { if (fb.fields && fb.fields[k] && v) data.set(fb.fields[k], v); };
    put('rating', rating);
    put('comment', fb.fields.page ? comment : (comment ? `${comment}\n\n[Página: ${page}]` : `[Página: ${page}]`));
    put('email', email);
    put('page', page);

    send.disabled = true; say('Enviando…');
    try {
      // Google Forms no devuelve confirmación al navegador (no-cors): si no hay error de red se da por enviado.
      await fetch(fb.action, { method: 'POST', mode: 'no-cors', body: data });
      store.set('fbLast', Date.now());
      form.reset(); paint(); say(''); form.hidden = true; done.hidden = false;
    } catch { say('No se pudo enviar. Comprueba tu conexión e inténtalo de nuevo.', 'err'); }
    send.disabled = false;
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const go = async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const ask = (w) => toast('Hay una nueva versión del curso.', { label: 'Actualizar', fn: () => w.postMessage('SKIP_WAITING') });
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
    } catch (e) { console.warn('Service worker no disponible', e); }
  };
  if (document.readyState === 'complete') go(); else addEventListener('load', go);
}

init();
