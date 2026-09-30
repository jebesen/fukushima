/* Autocomprobación del curso. Con el sitio abierto en el navegador (http://localhost:8080):
   F12 → pestaña «Consola» → pega TODO este fichero y pulsa Intro.
   Recorre las 6 unidades y avisa de: páginas que no cargan, imágenes/PDF/enlaces rotos,
   Flash, restos de plantillas Jinja y tests sin respuesta correcta. */
(async () => {
  const course = await (await fetch('data/course.json')).json();
  const known = new Set(course.units.flatMap((u) => [...u.lessons, ...(u.extras || [])].map((l) => `${u.id}/${l.id}`)));
  const problems = [], seen = new Map(), n = { paginas: 0, tests: 0, preguntas: 0, recursos: 0, enlaces: 0 };
  const exists = async (url, from) => {
    if (!seen.has(url)) {
      seen.set(url, fetch(url, { method: 'HEAD' }).then((r) => r.ok ? null : `${r.status}`).catch(() => 'sin respuesta'));
      n.recursos++;
    }
    const err = await seen.get(url);
    if (err) problems.push(`${err} → ${url}  (en ${from})`);
  };
  for (const u of course.units) {
    for (const l of [...u.lessons, ...(u.extras || [])]) {
      const key = `${u.id}/${l.id}`;
      if (l.type === 'quiz') {
        const r = await fetch(`content/${u.id}/auto.json`);
        if (!r.ok) { problems.push(`${r.status} → test ${key}`); continue; }
        const q = await r.json(); n.tests++;
        for (const x of q.questions) {
          n.preguntas++;
          const ok = x.options.filter((o) => o.correct).length;
          if (!ok) problems.push(`Test ${key} P${x.n}: ninguna opción correcta`);
          if (!x.multiple && ok > 1) problems.push(`Test ${key} P${x.n}: opción única con ${ok} correctas`);
          if (x.options.length < 2) problems.push(`Test ${key} P${x.n}: menos de 2 opciones`);
          if (x.image) await exists(x.image, key);
        }
        continue;
      }
      const r = await fetch(`content/${u.id}/${l.id}.html`);
      if (!r.ok) { problems.push(`${r.status} → contenido ${key}`); continue; }
      const txt = await r.text(); n.paginas++;
      if (/\{%|\{\{/.test(txt)) problems.push(`Restos de Jinja en ${key}`);
      const d = new DOMParser().parseFromString(txt, 'text/html');
      if (d.querySelector('object,embed')) problems.push(`Elemento Flash/embed en ${key}`);
      if (!d.body.textContent.trim() && !d.querySelector('.anim,iframe')) problems.push(`Página vacía: ${key}`);
      const imgs = [...d.querySelectorAll('img[src]')].map((i) => i.getAttribute('src'));
      d.querySelectorAll('.term[data-html]').forEach((t) => {   // imágenes dentro de los popovers
        new DOMParser().parseFromString(t.dataset.content, 'text/html').querySelectorAll('img[src]').forEach((i) => imgs.push(i.getAttribute('src')));
      });
      for (const s of imgs) await exists(s, key);
      for (const a of d.querySelectorAll('a[href]')) {
        const h = a.getAttribute('href'); n.enlaces++;
        if (h.startsWith('#/')) { if (!known.has(h.slice(2)) && h !== '#/creditos' && h !== '#/') problems.push(`Enlace interno roto ${h}  (en ${key})`); }
        else if (h.startsWith('assets/')) {
          if (/\.pdf($|[?#])/i.test(h)) problems.push(`Enlace local a PDF (debería haberse eliminado): ${h}  (en ${key})`);
          else await exists(h, key);
        }
        else if (h.startsWith('/') || h.startsWith('http://')) problems.push(`Enlace sospechoso «${h}»  (en ${key})`);
      }
    }
  }
  console.log(`%cRevisadas ${n.paginas} páginas, ${n.tests} tests (${n.preguntas} preguntas), ${n.recursos} recursos y ${n.enlaces} enlaces.`, 'font-weight:bold');
  if (problems.length) { console.warn(`${problems.length} problemas:`); problems.forEach((p) => console.warn(' •', p)); }
  else console.log('%cTodo correcto ✔', 'color:green;font-weight:bold');
  return problems.length ? problems : 'OK';
})();
