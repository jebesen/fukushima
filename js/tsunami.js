/* Animación esquemática (SVG) de cómo se origina y llega un tsunami.
   Sustituye a la antigua infografía en Flash del apartado 2.4.
   Corte transversal: placa oceánica que se hunde bajo la continental, rotura de la falla,
   propagación de las olas y llegada a la costa. Las alturas están exageradas para poder verlas.
   Una sola variable de tiempo t ∈ [0, 4]; cada etapa es un número entero. */

const W = 800, H = 470, SEA = 150, TR = 200, COAST = 560, PX = 280, PLANT_X = 650;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const G = (x, c, s) => Math.exp(-(((x - c) / s) ** 2));
const f = (n) => n.toFixed(1);

export const STAGES = [
  ['Situación inicial', 'La placa oceánica se desliza lentamente bajo la placa continental. El mar está en calma.'],
  ['Acumulación de tensión', 'Las placas quedan trabadas por rozamiento y el borde de la placa continental se va deformando hacia abajo, acumulando energía.'],
  ['Ruptura de la falla', 'La falla cede de golpe: el fondo marino se eleva varios metros y arrastra consigo toda la columna de agua. Es el terremoto.'],
  ['Propagación', 'La elevación del agua se divide en dos trenes de olas que viajan en sentidos opuestos. En mar abierto apenas tienen altura, pero son larguísimas y muy rápidas (cientos de km/h).'],
  ['Llegada a la costa', 'Al disminuir la profundidad la ola se frena, se comprime y crece en altura. En Fukushima alcanzó unos 14–15 m, superó el dique de 5,7 m e inundó la central.'],
];

/* ---- Geometría ---- */
function bed0(x) {
  if (x < TR) return 320 + 25 * ease(x / TR);
  if (x < COAST) return 345 - 195 * Math.pow((x - TR) / (COAST - TR), 0.85);
  if (x < COAST + 40) return SEA - 38 * ease((x - COAST) / 40); // pequeño acantilado
  return 112 - 0.03 * (x - COAST - 40); // planicie donde se asienta la central
}
const slabTop = (x) => (x < TR ? bed0(x) : 345 + 0.21 * (x - TR));
const uplift = (x) => (x <= TR ? 0 : G(x, PX, 85) * Math.min(1, (x - TR) / 40));

function disp(t) { // desplazamiento vertical del fondo, en px (+ = sube)
  if (t < 1) return -10 * ease(t);
  if (t < 2) return -10 + 40 * ease((t - 1) / 0.35);
  return 30;
}
const bed = (x, t) => bed0(x) - disp(t) * uplift(x);

function wave(x, t) { // elevación de la superficie del agua sobre el nivel del mar, en px
  if (t < 1) return 0;
  if (t < 2) return 30 * ease((t - 1.15) / 0.6) * G(x, PX, 70);
  if (t < 3) {
    const s = 110 * ease(t - 2), sg = 70 + 10 * (t - 2);
    return 15 * (G(x, PX - s, sg) + G(x, PX + s, sg));
  }
  const u = t - 3;
  const left = 15 * G(x, PX - 110 - 130 * ease(u), 80 + 20 * u);
  const xr = PX + 110 + 250 * Math.pow(u, 1.15), A = 15 + 47 * Math.pow(u, 1.6);
  const sgBack = 80 + 15 * u, sgFront = 62 - 8 * u; // detrás de la cresta queda una lámina de agua que inunda la planicie
  return left + A * G(x, xr, x > xr ? sgFront : sgBack);
}
export const crest = (t) => (t < 3 ? null : { x: PX + 110 + 250 * Math.pow(t - 3, 1.15), a: 15 + 47 * Math.pow(t - 3, 1.6) });

/* ---- Cálculo de un fotograma (funciones puras: se pueden probar sin DOM) ---- */
export function buildFrame(t) {
  const xs = [];
  for (let x = 0; x <= W; x += 4) xs.push(x);
  const top = xs.map((x) => SEA - wave(x, t));
  const bd = xs.map((x) => bed(x, t));
  const bot = xs.map((x, i) => Math.max(bd[i], top[i]));

  const water = 'M' + xs.map((x, i) => `${x},${f(top[i])}`).join('L') + 'L' + [...xs].reverse().map((x, j) => `${x},${f(bot[xs.length - 1 - j])}`).join('L') + 'Z';
  let line = '', pen = false;
  xs.forEach((x, i) => {
    const wet = bd[i] - top[i] > 0.8;
    if (wet) { line += `${pen ? 'L' : 'M'}${x},${f(top[i])}`; pen = true; } else pen = false;
  });

  const ci = xs.findIndex((x) => x >= TR);
  const crust = 'M' + xs.slice(ci).map((x, k) => `${x},${f(bd[ci + k])}`).join('L')
    + 'L' + [...xs.slice(ci)].reverse().map((x) => `${x},${f(slabTop(x))}`).join('L') + 'Z';
  const slab = 'M' + xs.map((x) => `${x},${f(slabTop(x))}`).join('L')
    + 'L' + [...xs].reverse().map((x) => `${x},${f(slabTop(x) + 42)}`).join('L') + 'Z';

  const bx = 110, by = SEA - wave(bx, t);
  const ang = (Math.atan2(-(wave(bx + 10, t) - wave(bx - 10, t)), 20) * 180) / Math.PI;
  const c = crest(t);
  return {
    water, line, crust, slab,
    boat: `translate(${bx} ${f(by)}) rotate(${f(ang)})`,
    quake: clamp((t - 1.0) / 0.15) * clamp((2.6 - t) / 0.4),
    quakeR: 10 + 45 * ((t * 1.5) % 1),
    crestLbl: c ? { x: Math.min(c.x, 720) - 34, y: Math.max(16, SEA - c.a - 10), o: clamp((t - 3.55) / 0.3) } : { x: 0, y: 0, o: 0 },
    deepLbl: clamp((t - 2.6) / 0.4) * clamp((3.9 - t) / 0.3),
    plantY: bed0(PLANT_X + 15),
  };
}

/* ---- Componente ---- */
export function mountTsunami(host) {
  const py = f(buildFrame(0).plantY);
  host.classList.add('anim-tsunami');
  host.innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Corte transversal que muestra cómo la rotura de la falla eleva el fondo marino, genera olas que se propagan y crecen al llegar a la costa">
    <defs>
      <linearGradient id="tz-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset="1" stop-color="var(--sky2)"/></linearGradient>
      <marker id="tz-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#f5c518"/></marker>
    </defs>
    <rect width="${W}" height="${SEA + 6}" fill="url(#tz-sky)"/>
    <rect y="${SEA}" width="${W}" height="${H - SEA}" fill="var(--sky2)"/>
    <rect y="345" width="${W}" height="${H - 345}" fill="#5a3a35"/>
    <path id="tz-slab" fill="#56657a"/>
    <path id="tz-crust" fill="#9a7654"/>
    <line x1="0" x2="${W}" y1="${SEA}" y2="${SEA}" stroke="var(--tz-ink)" stroke-opacity=".45" stroke-dasharray="6 6"/>
    <text x="8" y="${SEA - 6}" class="tz-t small">Nivel del mar</text>
    <g class="tz-plant">
      <rect x="549" y="${SEA - 23}" width="9" height="46" fill="#8b949e" rx="1"/>
      <rect x="${PLANT_X}" y="${f(+py - 36)}" width="34" height="40" fill="#dfe4ea" stroke="#8b949e"/>
      <rect x="${PLANT_X + 24}" y="${f(+py - 54)}" width="7" height="20" fill="#dfe4ea" stroke="#8b949e"/>
      <rect x="${PLANT_X + 6}" y="${f(+py - 24)}" width="8" height="10" fill="#8b949e"/>
    </g>
    <path id="tz-water" fill="#2f86d6" fill-opacity=".82"/>
    <path id="tz-line" fill="none" stroke="#cfe8ff" stroke-width="2" stroke-linejoin="round"/>
    <g id="tz-boat"><path d="M-15 -1H15L10 8H-10z" fill="#c0392b"/><path d="M0 -1V-24" stroke="var(--tz-ink)" stroke-width="2"/><path d="M1 -23 15 -6H1z" fill="#fff" stroke="#9aa5b1"/></g>
    <g id="tz-quake" opacity="0">
      <circle id="tz-ring" cx="${PX}" cy="362" r="10" fill="none" stroke="#f5c518" stroke-width="3"/>
      <path d="M${PX} 344l5 11 12-2-8 9 9 8-12-1-3 12-5-11-12 2 8-9-9-8 12 1z" fill="#f5c518" stroke="#b58900"/>
      <text x="${PX + 26}" y="348" class="tz-t bold">¡Sismo!</text>
    </g>
    <line x1="60" y1="${f(bed0(60) + 22)}" x2="150" y2="${f(bed0(150) + 26)}" stroke="#f5c518" stroke-width="4" marker-end="url(#tz-arr)"/>
    <text x="30" y="${f(bed0(60) + 66)}" class="tz-t">Placa oceánica</text>
    <text x="440" y="345" class="tz-t">Placa continental</text>
    <text x="${PLANT_X - 6}" y="${f(+py - 64)}" class="tz-t small">Central nuclear</text>
    <text x="455" y="${SEA + 44}" class="tz-t small w">Dique 5,7 m</text>
    <g id="tz-deep" opacity="0"><text x="20" y="60" class="tz-t bold">Mar abierto: olas bajas,</text><text x="20" y="78" class="tz-t bold">largas y muy rápidas</text></g>
    <g id="tz-crestL" opacity="0"><text id="tz-crestT" text-anchor="end" class="tz-t bold">≈ 14–15 m</text></g>
  </svg>
  <div class="anim-ctl">
    <button type="button" class="btn" data-a="play"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg><span>Reproducir</span></button>
    <input type="range" min="0" max="4" step="0.005" value="0" aria-label="Progreso de la animación">
  </div>
  <div class="chips" role="group" aria-label="Etapas">${STAGES.map((s, i) => `<button type="button" data-s="${i}">${i + 1}. ${s[0]}</button>`).join('')}</div>
  <p class="anim-cap" aria-live="polite"></p>`;

  const $ = (s) => host.querySelector(s);
  const el = { slab: $('#tz-slab'), crust: $('#tz-crust'), water: $('#tz-water'), line: $('#tz-line'), boat: $('#tz-boat'),
    quake: $('#tz-quake'), ring: $('#tz-ring'), deep: $('#tz-deep'), crestL: $('#tz-crestL'), crestT: $('#tz-crestT') };
  const range = $('input[type=range]'), btn = $('[data-a=play]'), cap = $('.anim-cap');
  const chips = [...host.querySelectorAll('.chips button')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0, raf = 0, playing = false, last = 0;

  function draw() {
    const fr = buildFrame(t);
    el.slab.setAttribute('d', fr.slab); el.crust.setAttribute('d', fr.crust);
    el.water.setAttribute('d', fr.water); el.line.setAttribute('d', fr.line);
    el.boat.setAttribute('transform', fr.boat);
    el.quake.setAttribute('opacity', fr.quake.toFixed(2)); el.ring.setAttribute('r', fr.quakeR.toFixed(1));
    el.deep.setAttribute('opacity', fr.deepLbl.toFixed(2));
    el.crestL.setAttribute('opacity', fr.crestLbl.o.toFixed(2));
    el.crestT.setAttribute('x', f(fr.crestLbl.x)); el.crestT.setAttribute('y', f(fr.crestLbl.y));
    range.value = t;
    const s = Math.min(4, Math.round(t));
    chips.forEach((c, i) => { c.classList.toggle('on', i === s); c.setAttribute('aria-pressed', i === s); });
    cap.textContent = STAGES[s][1];
  }
  function label() {
    const span = btn.querySelector('span'), use = btn.querySelector('use');
    span.textContent = playing ? 'Pausa' : t >= 3.999 ? 'Repetir' : 'Reproducir';
    use.setAttribute('href', playing ? '#i-pause' : '#i-play');
  }
  function stop() { playing = false; cancelAnimationFrame(raf); label(); }
  function tick(now) {
    if (!playing) return;
    t = Math.min(4, t + ((now - last) / 1000) * 0.32);
    last = now; draw();
    if (t >= 4) return stop();
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (reduce) { t = Math.min(4, Math.floor(t) + 1); draw(); return label(); }
    if (t >= 3.999) t = 0;
    playing = true; last = performance.now(); label(); raf = requestAnimationFrame(tick);
  }
  function goTo(target) {
    stop();
    if (reduce) { t = target; draw(); return label(); }
    const from = t, t0 = performance.now(), dur = 650 + Math.abs(target - from) * 350;
    playing = false;
    const step = (now) => {
      const k = ease((now - t0) / dur);
      t = from + (target - from) * k; draw();
      if (k < 1) raf = requestAnimationFrame(step); else label();
    };
    raf = requestAnimationFrame(step);
  }
  btn.addEventListener('click', () => (playing ? stop() : play()));
  range.addEventListener('input', () => { stop(); t = +range.value; draw(); label(); });
  chips.forEach((c) => c.addEventListener('click', () => goTo(+c.dataset.s)));
  draw(); label();
  return () => { stop(); };
}
