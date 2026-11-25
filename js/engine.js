// Motor del cuadrante: ciclo 6-3, reparto de terminales, guardias y totales.
// Sin dependencias del navegador para poder probarlo con Node.
(function (root) {
  'use strict';

  const DAY = 86400000;
  // Referencia fija del ciclo: lunes 1 de enero de 2024.
  const REF = Date.UTC(2024, 0, 1) / DAY;

  const GROUPS = ['M', 'T', 'N'];
  const GROUP_NAMES = { M: 'MAÑANA', T: 'TARDE', N: 'NOCHE' };
  const SHIFT_CODES = ['M2', 'M4', 'MT2', 'MT4', 'T2', 'T4', 'N2', 'N4'];
  const ABSENCE_CODES = ['V', 'B', 'P', 'FI'];
  const ALL_CODES = SHIFT_CODES.concat(ABSENCE_CODES);

  const dn = (y, m, d) => Date.UTC(y, m, d) / DAY; // m: 0-11
  const fromDn = (n) => { const t = new Date(n * DAY); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }; };
  const weekday = (n) => (new Date(n * DAY).getUTCDay() + 6) % 7; // 0 = lunes ... 6 = domingo
  const isoOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const dnOfIso = (s) => { const [y, m, d] = s.split('-').map(Number); return dn(y, m - 1, d); };
  const mod = (a, b) => ((a % b) + b) % b;
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  // ¿Está el día en el bloque de 3 libres de la persona? phase = posición (0-8) del primer libre.
  function isOffCycle(phase, n) { return mod(n - REF - phase, 9) < 3; }

  // Grupo (M/T/N) de un código de turno; MT cuenta como mañana y tarde.
  function shiftGroups(code) {
    if (!code) return [];
    if (code.startsWith('MT')) return ['M', 'T'];
    if (code[0] === 'M') return ['M'];
    if (code[0] === 'T') return ['T'];
    if (code[0] === 'N') return ['N'];
    return [];
  }
  const terminalOf = (code) => (SHIFT_CODES.includes(code) ? code.slice(-1) : null);
  const isShift = (code) => SHIFT_CODES.includes(code);

  function guardLetter(settings, n) {
    const week = Math.floor((n - REF) / 7); // REF es lunes
    const [a, b] = settings.guardLetters || ['M', 'C'];
    return mod(week, 2) === 0 ? a : b;
  }

  /**
   * Calcula el cuadrante desde el primer día con datos hasta `untilDn`.
   * state: { people, history, overrides, holidays, settings, genStart }
   *  - history[pid][iso] = código importado (días anteriores a genStart)
   *  - overrides[pid][iso] = código fijado a mano ('' = libre forzado)
   * Devuelve { code(pid, n), auto(pid, n) }
   */
  function compute(state, untilDn) {
    const people = state.people.filter((p) => p.active !== false);
    const settings = state.settings;
    const holidays = new Set(state.holidays || []);
    const history = state.history || {};
    const overrides = state.overrides || {};
    const genStart = state.genStart != null ? state.genStart : untilDn;

    // Inicio: 28 días antes de genStart para sembrar el historial de terminales.
    let histStart = genStart;
    for (const pid in history) for (const iso in history[pid]) histStart = Math.min(histStart, dnOfIso(iso));
    histStart = Math.max(histStart, genStart - 40);

    const result = {}; // result[pid] = Map(n -> code)
    const autoRes = {};
    const log = {}; // log[pid] = [{n, t4}] solo días trabajados en su turno
    people.forEach((p) => { result[p.id] = new Map(); autoRes[p.id] = new Map(); log[p.id] = []; });

    const WINDOW = 27; // 3 ciclos
    const share = (pid, n) => {
      const l = log[pid]; let w = 0, f = 0;
      for (let i = l.length - 1; i >= 0 && l[i].n > n - WINDOW; i--) { w++; if (l[i].t4) f++; }
      return w ? f / w : 0.5;
    };
    const lastEntry = (pid) => log[pid][log[pid].length - 1];

    const end = Math.max(untilDn, histStart);
    for (let n = histStart; n <= end; n++) {
      const iso = isoOf(n);
      const wd = weekday(n);
      const weekendOrHoliday = wd >= 5 || holidays.has(iso);

      if (n < genStart) {
        people.forEach((p) => {
          const c = (overrides[p.id] && overrides[p.id][iso] != null) ? overrides[p.id][iso]
            : (history[p.id] && history[p.id][iso]) || '';
          result[p.id].set(n, c);
          autoRes[p.id].set(n, (history[p.id] && history[p.id][iso]) || '');
          if (isShift(c)) log[p.id].push({ n, t4: terminalOf(c) === '4' });
        });
        continue;
      }

      for (const g of GROUPS) {
        const members = people.filter((p) => p.group === g);
        const pool = [];
        let t4Taken = 0;
        const assign = (p, code, auto) => {
          result[p.id].set(n, code);
          autoRes[p.id].set(n, auto);
        };
        // Lo que dice el patrón para cada persona (antes de ausencias manuales)
        for (const p of members) {
          const ov = overrides[p.id] && overrides[p.id][iso];
          let auto = '';
          if (p.type === 'lv') {
            auto = weekendOrHoliday ? '' : (p.fixedCode || (g + '2'));
          } else if (!isOffCycle(p.phase, n)) {
            auto = 'ROT';
          }
          if (ov != null) {
            // Fijado a mano
            assign(p, ov, auto === 'ROT' ? '' : auto);
            if (isShift(ov) && shiftGroups(ov)[0] === g && !ov.startsWith('MT') && terminalOf(ov) === '4') t4Taken++;
            if (auto === 'ROT') pool.push({ p, locked: true });
            continue;
          }
          if (auto === 'ROT') {
            if (p.fixedTerminal === '2' || p.fixedTerminal === '4') {
              const code = g + p.fixedTerminal;
              assign(p, code, code);
              if (p.fixedTerminal === '4') t4Taken++;
            } else pool.push({ p, locked: false });
          } else {
            assign(p, auto, auto);
            if (auto && !auto.startsWith('MT') && terminalOf(auto) === '4') t4Taken++;
          }
        }
        // Reparto T2 / T4 entre los rotativos libres de terminal
        const free = pool.filter((x) => !x.locked).map((x) => x.p);
        const target = (settings.t4Target && settings.t4Target[g] != null) ? settings.t4Target[g] : 2;
        const need = Math.max(0, Math.min(target - t4Taken, free.length));
        const ranked = free.map((p) => {
          const last = lastEntry(p.id);
          const workedYesterday = last && last.n === n - 1;
          const continuingT4 = workedYesterday && last.t4;
          return { p, k1: continuingT4 ? 0 : 1, k2: share(p.id, n), k3: workedYesterday ? 1 : 0 };
        }).sort((a, b) => a.k1 - b.k1 || a.k2 - b.k2 || a.k3 - b.k3 || String(a.p.id).localeCompare(String(b.p.id)));
        ranked.forEach((x, i) => {
          const code = g + (i < need ? '4' : '2');
          assign(x.p, code, code);
        });
        // Para los fijados a mano que el patrón también pondría a trabajar, el "auto" es su terminal más probable
        pool.filter((x) => x.locked).forEach((x) => autoRes[x.p.id].set(n, g + '2'));
      }

      people.forEach((p) => {
        const c = result[p.id].get(n);
        if (isShift(c)) log[p.id].push({ n, t4: terminalOf(c) === '4' && !c.startsWith('MT') });
      });
    }

    return {
      code: (pid, n) => (result[pid] && result[pid].has(n) ? result[pid].get(n) : ''),
      auto: (pid, n) => (autoRes[pid] && autoRes[pid].has(n) ? autoRes[pid].get(n) : ''),
    };
  }

  // Resumen mensual por persona: HT (días trabajados + bajas), horas, V, B, días en T4
  function personSummary(sched, pid, days, hoursPerShift) {
    let work = 0, v = 0, b = 0, t4 = 0;
    for (const n of days) {
      const c = sched.code(pid, n);
      if (isShift(c)) { work++; if (terminalOf(c) === '4' && !c.startsWith('MT')) t4++; }
      else if (c === 'V') v++;
      else if (c === 'B') b++;
    }
    const ht = work + b;
    return { ht, horas: ht * hoursPerShift, v, b, t4 };
  }

  // Totales diarios como en el Excel
  function dayTotals(sched, people, n) {
    const t = { M: 0, T: 0, N: 0, T2: 0, T4: 0, total: 0, M4: 0, T4s: 0, N4: 0, M2: 0, T2s: 0, N2: 0 };
    for (const p of people) {
      if (p.active === false) continue;
      const c = sched.code(p.id, n);
      if (!isShift(c)) continue;
      t.total++;
      shiftGroups(c).forEach((g) => t[g]++);
      if (terminalOf(c) === '2') t.T2++; else t.T4++;
      if (c === 'M4') t.M4++; if (c === 'T4') t.T4s++; if (c === 'N4') t.N4++;
      if (c === 'M2') t.M2++; if (c === 'T2') t.T2s++; if (c === 'N2') t.N2++;
    }
    return t;
  }

  const api = {
    DAY, REF, GROUPS, GROUP_NAMES, SHIFT_CODES, ABSENCE_CODES, ALL_CODES,
    dn, fromDn, weekday, isoOf, dnOfIso, mod, daysInMonth, isOffCycle, shiftGroups, terminalOf, isShift,
    guardLetter, compute, personSummary, dayTotals,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
