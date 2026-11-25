(function () {
  'use strict';
  const E = window.Engine;
  const KEY = 'planillas-turnos-v1';
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    kids.flat().forEach((c) => c != null && n.append(c));
    return n;
  };

  // ---------- Estado ----------
  const defaults = () => ({
    people: [], history: {}, overrides: {}, holidays: [], genStart: null,
    settings: { t4Target: { M: 3, T: 2, N: 2 }, hoursPerShift: 8, guardLetters: ['M', 'C'] },
    view: null, sourceMonths: [],
  });
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); const d = defaults(); return { ...d, ...s, settings: { ...d.settings, ...s.settings, t4Target: { ...d.settings.t4Target, ...(s.settings || {}).t4Target } } }; }
    } catch (e) { /* sin almacenamiento */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('No se pudo guardar en este navegador'); } }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  // Mes visible
  function currentView() {
    if (state.view) return state.view;
    if (state.genStart != null) { const f = E.fromDn(state.genStart); return { y: f.y, m: f.m }; }
    const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() };
  }
  function setView(y, m) { const d = new Date(Date.UTC(y, m, 1)); state.view = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; save(); render(); }

  // Si no hay historial importado, el cuadrante se genera desde el primer mes que se mire
  function ensureGenStart(y, m) {
    if (state.genStart == null) { state.genStart = E.dn(y, m, 1); save(); }
  }
  function schedule(untilDn) { return E.compute(state, untilDn); }

  // ---------- Render principal ----------
  let tab = 'cuadrante';
  function render() {
    const empty = state.people.length === 0;
    $('#view-onboarding').classList.toggle('hidden', !empty);
    $('#tabs').classList.toggle('hidden', empty);
    $('#monthNav').classList.toggle('invisible', empty);
    $$('.actions button').forEach((b) => { b.disabled = empty; });
    $$('main > .view:not(#view-onboarding)').forEach((v) => v.classList.add('hidden'));
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (empty) return;
    const { y, m } = currentView();
    if (!$('#monthSel').options.length) MONTHS.forEach((n, i) => $('#monthSel').append(el('option', { value: i, text: n })));
    $('#monthSel').value = m; $('#yearSel').value = y;
    $('#view-' + tab).classList.remove('hidden');
    if (tab === 'cuadrante') renderGrid(y, m);
    if (tab === 'personal') renderStaff(y, m);
    if (tab === 'ausencias') renderAbsences(y, m);
    if (tab === 'ajustes') renderSettings();
  }

  function cellClass(code) {
    if (!code) return '';
    if (code === 'MT4' || code === 'MT2') return 'c-mt';
    if (E.isShift(code)) return 'c-t' + E.terminalOf(code);
    return 'c-' + code.toLowerCase();
  }

  function renderLegend() {
    const items = [['M2', 'Terminal 2', 'c-t2'], ['M4', 'Terminal 4', 'c-t4'], ['MT4', 'Mañana-tarde T4', 'c-mt'],
      ['V', 'Vacaciones', 'c-v'], ['B', 'Baja', 'c-b'], ['P', 'Permiso', 'c-p'], ['FI', 'Falta injustificada', 'c-fi']];
    $('#legend').replaceChildren(...items.map(([c, t, k]) => el('span', { class: 'lg' }, el('i', { class: 'sw ' + k, text: c }), t)),
      el('span', { class: 'lg' }, el('i', { class: 'sw hol', text: 'F' }), 'Festivo'));
  }

  function renderGrid(y, m) {
    ensureGenStart(y, m);
    renderLegend();
    const nd = E.daysInMonth(y, m);
    const start = E.dn(y, m, 1);
    const days = Array.from({ length: nd }, (_, i) => start + i);
    const sched = schedule(start + nd - 1);
    const hol = new Set(state.holidays);
    const active = state.people.filter((p) => p.active !== false);
    const t4t = state.settings.t4Target;
    const today = E.dn(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    const dayClass = (n) => [E.weekday(n) >= 5 ? 'we' : '', hol.has(E.isoOf(n)) ? 'hol' : '', n === today ? 'today' : ''].join(' ');
    const thead = el('thead', null,
      el('tr', null, el('th', { class: 'name corner', text: `${MONTHS[m]} ${y}` }),
        days.map((n, i) => el('th', { class: 'day ' + dayClass(n) }, el('div', { class: 'dnum', text: i + 1 }), el('div', { class: 'dwd', text: hol.has(E.isoOf(n)) ? 'F' : WD[E.weekday(n)] }))),
        ['HT', 'Horas', 'V', 'B', 'T4'].map((h) => el('th', { class: 'sum', text: h, title: { HT: 'Días trabajados + bajas', T4: 'Días en terminal 4' }[h] || '' }))));
    const tbody = el('tbody');
    for (const g of E.GROUPS) {
      tbody.append(el('tr', { class: 'section s-' + g }, el('th', { class: 'name', text: E.GROUP_NAMES[g] }), el('td', { colspan: nd + 5 })));
      const members = active.filter((p) => p.group === g);
      if (!members.length) tbody.append(el('tr', null, el('th', { class: 'name muted', text: 'Sin personal' }), el('td', { colspan: nd + 5 })));
      for (const p of members) {
        const tr = el('tr', null, el('th', { class: 'name', title: p.type === 'lv' ? 'Lunes a viernes' : '6-3' },
          el('span', { text: p.name }), p.type === 'lv' ? el('small', { class: 'tag', text: 'L-V' }) : null));
        days.forEach((n) => {
          const iso = E.isoOf(n);
          const code = sched.code(p.id, n);
          const ov = state.overrides[p.id] && state.overrides[p.id][iso] != null;
          tr.append(el('td', {
            class: `cell ${cellClass(code)} ${dayClass(n)} ${ov ? 'ov' : ''}`, text: code, 'data-pid': p.id, 'data-n': n, tabindex: 0,
          }));
        });
        const s = E.personSummary(sched, p.id, days, state.settings.hoursPerShift);
        [s.ht, s.horas, s.v, s.b, s.t4].forEach((v) => tr.append(el('td', { class: 'sum', text: v })));
        tbody.append(tr);
      }
    }
    // Guardias
    const gtr = el('tr', { class: 'guard' }, el('th', { class: 'name', text: 'GUARDIAS' }));
    days.forEach((n) => { const l = E.guardLetter(state.settings, n); gtr.append(el('td', { class: 'g ' + (l === state.settings.guardLetters[0] ? 'ga' : 'gb'), text: l })); });
    gtr.append(el('td', { colspan: 5 }));
    tbody.append(gtr);
    // Totales
    const totals = days.map((n) => E.dayTotals(sched, active, n));
    const tline = (label, fn, cls, warnFn) => {
      const tr = el('tr', { class: 'tot ' + (cls || '') }, el('th', { class: 'name', text: label }));
      totals.forEach((t, i) => tr.append(el('td', { class: (warnFn && warnFn(t, days[i]) ? 'warn ' : '') + dayClass(days[i]), text: fn(t) })));
      tr.append(el('td', { colspan: 5 }));
      tbody.append(tr);
    };
    tbody.append(el('tr', { class: 'spacer' }, el('td', { colspan: nd + 6 })));
    tline('Mañana', (t) => t.M);
    tline('Tarde', (t) => t.T);
    tline('Noche', (t) => t.N);
    tline('Terminal T2', (t) => t.T2, 'sep');
    tline('Terminal T4', (t) => t.T4);
    tline('M4 / T4 / N4', (t) => `${t.M4}·${t.T4s}·${t.N4}`, 'mini', (t) => t.M4 < t4t.M || t.T4s < t4t.T || t.N4 < t4t.N);
    tline('Total técnicos', (t) => t.total, 'sep strong');
    $('#grid').replaceChildren(thead, tbody);
  }

  // ---------- Selector de casilla ----------
  let pickTarget = null;
  function openPicker(td) {
    const pid = td.dataset.pid, n = Number(td.dataset.n);
    const p = state.people.find((x) => x.id === pid);
    const iso = E.isoOf(n);
    pickTarget = { pid, iso };
    const f = E.fromDn(n);
    const g = p.group;
    const shiftOpts = g === 'M' ? ['M2', 'M4', 'MT4'] : g === 'T' ? ['T2', 'T4', 'MT4'] : ['N2', 'N4'];
    const others = E.SHIFT_CODES.filter((c) => !shiftOpts.includes(c) && c !== 'MT2');
    const pk = $('#picker');
    const btn = (code, label, cls) => el('button', { class: 'pk ' + (cls || cellClass(code)), 'data-code': code, text: label || code });
    pk.replaceChildren(
      el('div', { class: 'pk-title' }, el('strong', { text: p.name }), ` · ${WD[E.weekday(n)]} ${f.d}/${f.m + 1}/${f.y}`),
      el('div', { class: 'pk-row' }, shiftOpts.map((c) => btn(c))),
      el('div', { class: 'pk-row' }, ['V', 'B', 'P', 'FI'].map((c) => btn(c)), btn('', 'Libre', 'c-free')),
      el('details', null, el('summary', { text: 'Otros turnos' }), el('div', { class: 'pk-row' }, others.map((c) => btn(c)))),
      el('div', { class: 'pk-row' }, btn('__auto', 'Automático', 'c-auto'), el('button', { class: 'pk c-free', 'data-close': '1', text: 'Cerrar' })),
    );
    pk.classList.remove('hidden');
    const r = td.getBoundingClientRect();
    const w = pk.offsetWidth, h = pk.offsetHeight;
    let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
    let top = r.bottom + 6; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    pk.style.left = left + 'px'; pk.style.top = top + 'px';
    const first = pk.querySelector('button'); if (first) first.focus();
  }
  function closePicker() { $('#picker').classList.add('hidden'); pickTarget = null; }
  $('#picker').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !pickTarget) return;
    if (b.dataset.close) return closePicker();
    const code = b.dataset.code;
    const { pid, iso } = pickTarget;
    state.overrides[pid] = state.overrides[pid] || {};
    if (code === '__auto') delete state.overrides[pid][iso];
    else state.overrides[pid][iso] = code;
    save(); closePicker(); render();
  });
  $('#grid').addEventListener('click', (e) => { const td = e.target.closest('td.cell'); if (td) openPicker(td); });
  $('#grid').addEventListener('keydown', (e) => { const td = e.target.closest('td.cell'); if (td && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPicker(td); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#picker') && !e.target.closest('td.cell')) closePicker(); });

  // ---------- Personal ----------
  function nextOffStart(p, fromDn) {
    for (let n = fromDn; n < fromDn + 9; n++) if (E.mod(n - E.REF - p.phase, 9) === 0) return n;
    return fromDn;
  }
  function renderStaff(y, m) {
    const from = E.dn(y, m, 1);
    const head = el('thead', null, el('tr', null, ['Nombre', 'Turno', 'Tipo', 'Primer día libre / turno fijo', 'Terminal', 'Activo', ''].map((h) => el('th', { text: h }))));
    const body = el('tbody');
    for (const g of E.GROUPS) {
      body.append(el('tr', { class: 'section s-' + g }, el('th', { colspan: 7, text: E.GROUP_NAMES[g] })));
      state.people.filter((p) => p.group === g).forEach((p) => {
        const upd = (fn) => () => { fn(); save(); renderStaff(y, m); };
        const name = el('input', { type: 'text', value: p.name, 'aria-label': 'Nombre' });
        name.addEventListener('change', () => { p.name = name.value.trim() || p.name; save(); });
        const grp = el('select', { 'aria-label': 'Turno' }, E.GROUPS.map((x) => el('option', { value: x, text: E.GROUP_NAMES[x], selected: x === p.group })));
        grp.addEventListener('change', upd(() => { p.group = grp.value; if (p.type === 'lv') p.fixedCode = grp.value === 'T' && p.fixedCode === 'MT4' ? 'MT4' : grp.value + '2'; }));
        const typ = el('select', { 'aria-label': 'Tipo' }, el('option', { value: 'rot', text: '6-3', selected: p.type === 'rot' }), el('option', { value: 'lv', text: 'L-V', selected: p.type === 'lv' }));
        typ.addEventListener('change', upd(() => { p.type = typ.value; if (p.type === 'lv' && !p.fixedCode) p.fixedCode = p.group + '2'; }));
        let detail;
        if (p.type === 'rot') {
          detail = el('input', { type: 'date', value: E.isoOf(nextOffStart(p, from)), 'aria-label': 'Primer día libre' });
          detail.addEventListener('change', () => { if (!detail.value) return; p.phase = E.mod(E.dnOfIso(detail.value) - E.REF, 9); save(); toast(`Ciclo de ${p.name} actualizado`); });
        } else {
          const opts = p.group === 'M' ? ['M2', 'M4', 'MT4', 'MT2'] : p.group === 'T' ? ['T2', 'T4', 'MT4', 'MT2'] : ['N2', 'N4'];
          detail = el('select', { 'aria-label': 'Turno fijo' }, opts.map((c) => el('option', { value: c, text: c, selected: c === p.fixedCode })));
          detail.addEventListener('change', () => { p.fixedCode = detail.value; save(); });
        }
        let term;
        if (p.type === 'rot') {
          term = el('select', { 'aria-label': 'Terminal' }, [['', 'Automática'], ['2', 'Siempre T2'], ['4', 'Siempre T4']].map(([v, t]) => el('option', { value: v, text: t, selected: (p.fixedTerminal || '') === v })));
          term.addEventListener('change', () => { p.fixedTerminal = term.value; save(); });
        } else term = el('span', { class: 'muted', text: '—' });
        const act = el('input', { type: 'checkbox', checked: p.active !== false, 'aria-label': 'Activo' });
        act.addEventListener('change', () => { p.active = act.checked; save(); });
        const idx = state.people.indexOf(p);
        const move = (d) => upd(() => {
          const same = state.people.filter((x) => x.group === p.group);
          const j = same.indexOf(p) + d; if (j < 0 || j >= same.length) return;
          const other = same[j]; const oi = state.people.indexOf(other);
          state.people[idx] = other; state.people[oi] = p;
        });
        const del = el('button', { class: 'icon danger-text', title: 'Eliminar', 'aria-label': 'Eliminar', text: '✕' });
        del.addEventListener('click', () => { if (confirm(`¿Eliminar a ${p.name}? Se borran también sus cambios manuales.`)) { state.people = state.people.filter((x) => x !== p); delete state.overrides[p.id]; save(); renderStaff(y, m); } });
        body.append(el('tr', null, el('td', null, name), el('td', null, grp), el('td', null, typ), el('td', null, detail), el('td', null, term), el('td', { class: 'center' }, act),
          el('td', { class: 'nowrap' }, el('button', { class: 'icon', title: 'Subir', 'aria-label': 'Subir', text: '↑', onclick: move(-1) }), el('button', { class: 'icon', title: 'Bajar', 'aria-label': 'Bajar', text: '↓', onclick: move(1) }), del)));
      });
    }
    $('#staff').replaceChildren(head, body);
  }
  $('#addPerson').addEventListener('click', () => {
    const name = prompt('Nombre de la persona'); if (!name) return;
    let id = window.Importer.slug(name) || 'p'; while (state.people.some((p) => p.id === id)) id += '-1';
    // Fase libre: la menos usada en mañana para equilibrar
    const used = state.people.filter((p) => p.group === 'M' && p.type === 'rot').map((p) => p.phase);
    let phase = 0, min = 1e9; for (let ph = 0; ph < 9; ph++) { const c = used.filter((x) => x === ph).length; if (c < min) { min = c; phase = ph; } }
    state.people.push({ id, name: name.trim(), group: 'M', type: 'rot', phase, fixedCode: '', fixedTerminal: '', active: true });
    save(); render(); toast('Añadida. Ajusta su turno y su primer día libre.');
  });

  // ---------- Ausencias ----------
  function absenceRuns() {
    const runs = [];
    for (const p of state.people) {
      const ov = state.overrides[p.id]; if (!ov) continue;
      const items = Object.keys(ov).filter((k) => E.ABSENCE_CODES.includes(ov[k])).sort();
      let cur = null;
      for (const iso of items) {
        const n = E.dnOfIso(iso), c = ov[iso];
        // Un bloque sigue aunque haya días libres en medio (máx. 3)
        if (cur && cur.code === c && n - cur.to <= 4) { cur.to = n; cur.days.push(iso); }
        else { cur = { p, code: c, from: n, to: n, days: [iso] }; runs.push(cur); }
      }
    }
    return runs.sort((a, b) => a.from - b.from);
  }
  const fmt = (n) => { const f = E.fromDn(n); return `${String(f.d).padStart(2, '0')}/${String(f.m + 1).padStart(2, '0')}/${f.y}`; };
  function renderAbsences(y, m) {
    const sel = $('#absPerson');
    const prev = sel.value;
    sel.replaceChildren(...E.GROUPS.map((g) => el('optgroup', { label: E.GROUP_NAMES[g] }, state.people.filter((p) => p.group === g && p.active !== false).map((p) => el('option', { value: p.id, text: p.name })))));
    if (prev) sel.value = prev;
    if (!$('#absFrom').value) { $('#absFrom').value = E.isoOf(E.dn(y, m, 1)); $('#absTo').value = E.isoOf(E.dn(y, m, 1)); }
    const runs = absenceRuns();
    const names = { V: 'Vacaciones', B: 'Baja', P: 'Permiso', FI: 'Falta injustificada' };
    if (!runs.length) { $('#absList').replaceChildren(el('p', { class: 'muted', text: 'No hay ausencias marcadas a mano.' })); return; }
    const tbl = el('table', { class: 'staff' }, el('thead', null, el('tr', null, ['Persona', 'Tipo', 'Desde', 'Hasta', 'Días', ''].map((h) => el('th', { text: h })))),
      el('tbody', null, runs.map((r) => el('tr', null, el('td', { text: r.p.name }), el('td', null, el('i', { class: 'sw ' + cellClass(r.code), text: r.code }), ' ', names[r.code]),
        el('td', { text: fmt(r.from) }), el('td', { text: fmt(r.to) }), el('td', { text: r.days.length }),
        el('td', null, el('button', { class: 'ghost small', text: 'Quitar', onclick: () => { r.days.forEach((iso) => delete state.overrides[r.p.id][iso]); save(); render(); } }))))));
    $('#absList').replaceChildren(tbl);
  }
  $('#absForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pid = $('#absPerson').value, code = $('#absType').value;
    let a = E.dnOfIso($('#absFrom').value), b = E.dnOfIso($('#absTo').value);
    if (b < a) [a, b] = [b, a];
    const p = state.people.find((x) => x.id === pid);
    const onlyWork = $('#absOnlyWork').checked;
    // Para saber qué días le tocaba trabajar, calculamos sin sus ausencias en ese tramo
    const saved = { ...(state.overrides[pid] || {}) };
    for (let n = a; n <= b; n++) if (state.overrides[pid]) delete state.overrides[pid][E.isoOf(n)];
    const sched = onlyWork ? schedule(b) : null;
    state.overrides[pid] = state.overrides[pid] || {};
    let count = 0;
    for (let n = a; n <= b; n++) {
      const iso = E.isoOf(n);
      if (!onlyWork || E.isShift(sched.code(pid, n))) { state.overrides[pid][iso] = code; count++; }
      else if (saved[iso] != null && !E.ABSENCE_CODES.includes(saved[iso])) state.overrides[pid][iso] = saved[iso];
    }
    save(); render(); toast(`${count} día(s) marcados como ${code} para ${p.name}`);
  });

  // ---------- Ajustes ----------
  function renderSettings() {
    const s = state.settings;
    $('#t4M').value = s.t4Target.M; $('#t4T').value = s.t4Target.T; $('#t4N').value = s.t4Target.N; $('#hours').value = s.hoursPerShift;
    $('#guardA').value = s.guardLetters[0]; $('#guardB').value = s.guardLetters[1];
    const t = new Date(); const today = E.dn(t.getFullYear(), t.getMonth(), t.getDate());
    $('#guardNow').textContent = `Esta semana: ${E.guardLetter(s, today)}`;
    $('#holidays').value = state.holidays.slice().sort().map((iso) => fmt(E.dnOfIso(iso))).join('\n');
    $('#dataInfo').textContent = `${state.people.length} personas. ` + (state.sourceMonths && state.sourceMonths.length ? `Importado de: ${state.sourceMonths.join(', ')}. ` : '') +
      (state.genStart != null ? `Generación automática desde el ${fmt(state.genStart)}.` : '');
  }
  const num = (id, def) => { const v = parseInt($(id).value, 10); return Number.isFinite(v) && v >= 0 ? v : def; };
  ['#t4M', '#t4T', '#t4N', '#hours'].forEach((id) => $(id).addEventListener('change', () => {
    const s = state.settings;
    s.t4Target = { M: num('#t4M', 3), T: num('#t4T', 2), N: num('#t4N', 2) };
    s.hoursPerShift = num('#hours', 8) || 8; save(); toast('Guardado');
  }));
  ['#guardA', '#guardB'].forEach((id) => $(id).addEventListener('change', () => {
    state.settings.guardLetters = [$('#guardA').value.trim().toUpperCase() || 'M', $('#guardB').value.trim().toUpperCase() || 'C']; save(); renderSettings();
  }));
  $('#swapGuard').addEventListener('click', () => { state.settings.guardLetters.reverse(); save(); renderSettings(); toast('Guardias intercambiadas'); });
  $('#saveHolidays').addEventListener('click', () => {
    const bad = []; const out = new Set();
    $('#holidays').value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).forEach((line) => {
      const mm = line.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/) || null;
      const iso = line.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mm) { let yy = +mm[3]; if (yy < 100) yy += 2000; out.add(E.isoOf(E.dn(yy, +mm[2] - 1, +mm[1]))); }
      else if (iso) out.add(line); else bad.push(line);
    });
    state.holidays = [...out].sort(); save(); renderSettings();
    $('#holMsg').textContent = bad.length ? `No entiendo: ${bad.join(', ')}` : `${out.size} festivos guardados`;
  });

  // ---------- Importar / exportar ----------
  async function importExcel(file) {
    try {
      const wb = new window.ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const r = window.Importer.buildState(wb, 2);
      if (state.people.length && !confirm('Esto sustituye la plantilla, el historial y los cambios manuales por lo que hay en el Excel. ¿Continuar?')) return;
      const s = defaults();
      s.settings = { ...state.settings, guardLetters: r.guardLetters };
      s.people = r.people; s.history = r.history; s.genStart = r.genStart; s.sourceMonths = r.sourceMonths;
      s.holidays = [...new Set([...(state.holidays || []), ...r.holidays, ...defaultHolidays()])].sort();
      const f = E.fromDn(r.genStart); s.view = { y: f.y, m: f.m };
      state = s; save(); tab = 'cuadrante'; render();
      const lv = r.people.filter((p) => p.type === 'lv').length;
      toast(`Importadas ${r.people.length} personas (${lv} L-V) de ${r.sourceMonths.join(' y ')}. Revisa la pestaña Personal.`);
    } catch (err) {
      console.error(err); alert('No he podido leer el Excel: ' + err.message);
    }
  }
  // Festivos nacionales de fecha fija de los próximos años (los demás, en Ajustes)
  function defaultHolidays() {
    const y0 = new Date().getFullYear(); const out = [];
    for (let y = y0; y <= y0 + 2; y++) ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'].forEach((d) => out.push(`${y}-${d}`));
    return out;
  }
  $$('.importFile').forEach((inp) => inp.addEventListener('change', () => { if (inp.files[0]) importExcel(inp.files[0]); inp.value = ''; }));
  $('#startEmpty').addEventListener('click', () => {
    const name = prompt('Nombre de la primera persona'); if (!name) return;
    state.people.push({ id: window.Importer.slug(name) || 'p1', name: name.trim(), group: 'M', type: 'rot', phase: 0, fixedCode: '', fixedTerminal: '', active: true });
    state.holidays = defaultHolidays(); save(); tab = 'personal'; render();
  });
  $('#exportJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `planillas-copia-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
  });
  $('#importJson').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const s = JSON.parse(await f.text()); if (!Array.isArray(s.people)) throw new Error('formato'); state = { ...defaults(), ...s }; save(); render(); toast('Copia restaurada'); }
    catch (err) { alert('Ese archivo no es una copia válida.'); }
  });
  $('#resetAll').addEventListener('click', () => { if (confirm('¿Borrar toda la plantilla, ausencias y ajustes de este navegador?')) { state = defaults(); save(); tab = 'cuadrante'; render(); } });

  async function doExport(months, filename) {
    const last = months[months.length - 1];
    months.forEach(({ y, m }) => ensureGenStart(y, m));
    const sched = schedule(E.dn(last.y, last.m, E.daysInMonth(last.y, last.m)));
    try { await window.Exporter.exportMonths(state, sched, months, MONTHS, filename); }
    catch (err) { console.error(err); alert('No se pudo generar el Excel: ' + err.message); }
  }
  $('#exportMonth').addEventListener('click', () => { const { y, m } = currentView(); doExport([{ y, m }], `Cuadrante ${MONTHS[m]} ${y}.xlsx`); });
  $('#exportYear').addEventListener('click', () => { const { y } = currentView(); doExport(MONTHS.map((_, m) => ({ y, m })), `Cuadrante ${y}.xlsx`); });
  $('#printBtn').addEventListener('click', () => { tab = 'cuadrante'; render(); setTimeout(() => window.print(), 50); });

  // ---------- Navegación ----------
  $('#prevMonth').addEventListener('click', () => { const { y, m } = currentView(); setView(y, m - 1); });
  $('#nextMonth').addEventListener('click', () => { const { y, m } = currentView(); setView(y, m + 1); });
  $('#monthSel').addEventListener('change', () => setView(currentView().y, Number($('#monthSel').value)));
  $('#yearSel').addEventListener('change', () => { const y = parseInt($('#yearSel').value, 10); if (y >= 2000 && y <= 2100) setView(y, currentView().m); });
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });

  render();
})();
