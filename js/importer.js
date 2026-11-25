// Lee un cuadrante en Excel (formato actual) y deduce plantilla, fases del 6-3, festivos y guardias.
(function (root) {
  'use strict';
  const E = root.Engine;

  function val(cell) {
    let v = cell && cell.value;
    if (v == null) return null;
    if (typeof v === 'object' && !(v instanceof Date)) {
      if ('result' in v) v = v.result;
      else if (v.richText) v = v.richText.map((r) => r.text).join('');
      else if ('text' in v) v = v.text;
      else if (v.error) return null;
    }
    return v;
  }
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const HEADERS = { 'manana': 'M', 'tarde': 'T', 'noche': 'N' };

  function parseSheet(ws) {
    const a1 = val(ws.getCell(1, 1));
    if (!(a1 instanceof Date)) return null;
    const start = E.dn(a1.getUTCFullYear(), a1.getUTCMonth(), 1);
    const y = a1.getUTCFullYear(), m = a1.getUTCMonth();
    // Días = enteros consecutivos en la fila 1 desde la columna B
    let ndays = 0;
    for (let c = 2; c <= 32; c++) { const v = val(ws.getCell(1, c)); if (typeof v === 'number') ndays++; else break; }
    ndays = Math.min(ndays, E.daysInMonth(y, m));
    const rows = [];
    let group = null, guard = null;
    for (let r = 3; r <= Math.min(ws.rowCount, 200); r++) {
      const name = val(ws.getCell(r, 1));
      if (name == null || String(name).trim() === '') continue;
      const key = norm(name);
      if (key.startsWith('guardia')) {
        guard = [];
        for (let i = 0; i < ndays; i++) { const v = val(ws.getCell(r, 2 + i)); guard.push(v ? String(v).trim().toUpperCase() : ''); }
        break;
      }
      if (HEADERS[key]) { group = HEADERS[key]; continue; }
      if (!group || key.startsWith('tecnicos')) continue;
      const codes = [];
      for (let i = 0; i < ndays; i++) {
        const v = val(ws.getCell(r, 2 + i));
        codes.push(v == null ? '' : String(v).trim().toUpperCase());
      }
      rows.push({ name: String(name).trim(), group, codes });
    }
    return { title: ws.name, start, ndays, rows, guard };
  }

  // Importa el año completo del último mes del Excel (como mínimo los dos últimos meses).
  // El ciclo 6-3 y el tipo de cada persona se deducen solo de los dos últimos meses.
  function buildState(wb) {
    const sheets = [];
    wb.eachSheet((ws) => { const s = parseSheet(ws); if (s && s.rows.length) sheets.push(s); });
    if (!sheets.length) throw new Error('No encuentro ninguna hoja de cuadrante (la celda A1 de cada mes debe ser una fecha).');
    sheets.sort((a, b) => a.start - b.start);
    const recent = sheets.slice(-2);
    const latest = recent[recent.length - 1];
    const yearStart = E.dn(E.fromDn(latest.start).y, 0, 1);
    const used = sheets.filter((s) => s.start >= Math.min(yearStart, recent[0].start));

    // Personas: las que aparecen en el mes más reciente (con algún dato)
    const people = [];
    const byKey = {};
    latest.rows.forEach((r) => {
      if (!r.codes.some((c) => c)) return; // filas vacías tipo "Tecnico X"
      const id = slug(r.name);
      if (byKey[id]) return;
      const p = { id, name: r.name, group: r.group, type: 'rot', phase: 0, fixedCode: '', fixedTerminal: '', active: true };
      byKey[id] = p; people.push(p);
    });

    const history = {};
    const samples = {}; // id -> [{n, c}]
    used.forEach((s) => s.rows.forEach((r) => {
      const id = slug(r.name);
      if (!byKey[id]) return;
      history[id] = history[id] || {};
      samples[id] = samples[id] || [];
      const isRecent = recent.includes(s);
      r.codes.forEach((c, i) => {
        const n = s.start + i;
        if (c) history[id][E.isoOf(n)] = c;
        if (isRecent) samples[id].push({ n, c });
      });
    }));

    // Tipo y fase
    people.forEach((p) => {
      const sm = samples[p.id] || [];
      const worked = sm.filter((x) => E.isShift(x.c));
      const blanks = sm.filter((x) => !x.c);
      const weekendWorked = worked.filter((x) => E.weekday(x.n) >= 5).length;
      const blankWeekend = blanks.filter((x) => E.weekday(x.n) >= 5).length;
      let best = 0, bestScore = -1e9;
      for (let ph = 0; ph < 9; ph++) {
        let s = 0;
        blanks.forEach((x) => { if (E.isOffCycle(ph, x.n)) s++; });
        worked.forEach((x) => { if (E.isOffCycle(ph, x.n)) s -= 1; });
        if (s > bestScore) { bestScore = s; best = ph; }
      }
      const rotFit = blanks.length ? blanks.filter((x) => E.isOffCycle(best, x.n)).length / blanks.length : 0;
      const lvFit = blanks.length ? blankWeekend / blanks.length : 0;
      const isLv = worked.length > 0 ? weekendWorked === 0 && lvFit > 0.7 : lvFit > 0.9 && lvFit > rotFit;
      const counts = {};
      worked.forEach((x) => { counts[x.c] = (counts[x.c] || 0) + 1; });
      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (isLv) { p.type = 'lv'; p.fixedCode = top || (p.group + '2'); }
      else { p.type = 'rot'; p.phase = best; }
    });

    // Festivos: días laborables en los que ninguna persona L-V trabaja (y no está de V/B)
    const holidays = [];
    used.forEach((s) => {
      const lvRows = s.rows.filter((r) => byKey[slug(r.name)] && byKey[slug(r.name)].type === 'lv');
      for (let i = 0; i < s.ndays; i++) {
        const n = s.start + i;
        if (E.weekday(n) >= 5) continue;
        const present = lvRows.filter((r) => r.codes[i] !== 'V' && r.codes[i] !== 'B' && r.codes.some((c) => E.isShift(c)));
        if (present.length >= 2 && present.every((r) => !r.codes[i])) holidays.push(E.isoOf(n));
      }
    });

    // Guardias: qué letra va en semanas pares desde el 1/1/2024
    let guardLetters = ['M', 'C'];
    const g = latest.guard || (used[0] && used[0].guard);
    if (g) {
      const src = latest.guard ? latest : used[0];
      const letters = [...new Set(g.filter(Boolean))];
      if (letters.length === 2) {
        for (let i = 0; i < src.ndays; i++) {
          const n = src.start + i;
          if (E.weekday(n) === 0 && g[i]) {
            const even = E.mod(Math.floor((n - E.REF) / 7), 2) === 0;
            const other = letters.find((l) => l !== g[i]);
            guardLetters = even ? [g[i], other] : [other, g[i]];
            break;
          }
        }
      }
    }

    // Fecha de alta: primer día con cualquier dato (turno, V, B…) en todas las hojas del Excel
    const firstDay = {};
    sheets.forEach((s) => s.rows.forEach((r) => {
      const id = slug(r.name);
      if (!byKey[id] || firstDay[id] != null) return;
      const i = r.codes.findIndex((c) => c);
      if (i >= 0) firstDay[id] = s.start + i;
    }));
    const excelStart = sheets[0].start;
    people.forEach((p) => {
      // Si ya estaba el primer día del Excel no sabemos cuándo empezó: se deja sin fecha
      if (firstDay[p.id] != null && firstDay[p.id] > excelStart + 9) p.startDate = E.isoOf(firstDay[p.id]);
    });

    const genStart = latest.start + latest.ndays;
    return {
      people, history, holidays, guardLetters, genStart,
      sourceMonths: used.map((s) => s.title),
    };
  }

  root.Importer = { buildState, parseSheet, slug, norm };
})(typeof window !== 'undefined' ? window : globalThis);
