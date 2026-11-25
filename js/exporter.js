// Exporta uno o varios meses a .xlsx con el mismo aspecto que el cuadrante original.
(function (root) {
  'use strict';
  const E = root.Engine;

  const FILL = {
    '2': 'FF00B050', '4': 'FFFFFF00', V: 'FFFF0000', B: 'FF00B0F0', P: 'FFFFC000', FI: 'FF7F7F7F',
    weekend: 'FFD9D9D9', holiday: 'FFF2DCDB', M: 'FF00B0F0', T: 'FFFFFF00', N: 'FF7030A0',
  };
  const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  function codeFill(code) {
    if (!code) return null;
    if (code === 'MT4' || code === 'MT2') return null;
    if (E.isShift(code)) return FILL[E.terminalOf(code)];
    return FILL[code] || null;
  }

  function addMonth(wb, state, sched, y, m, monthName) {
    const ws = wb.addWorksheet(`${monthName} ${y}`, { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
    const nd = E.daysInMonth(y, m);
    const start = E.dn(y, m, 1);
    const days = Array.from({ length: nd }, (_, i) => start + i);
    const hol = new Set(state.holidays);
    const people = state.people.filter((p) => p.active !== false);
    const sumCol = nd + 3;
    const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    ws.getColumn(1).width = 26;
    for (let i = 0; i < nd; i++) ws.getColumn(2 + i).width = 4.6;
    ['HT', 'HORAS', 'V', 'B', 'T4'].forEach((_, k) => { ws.getColumn(sumCol + k).width = 7; });

    const r1 = ws.getRow(1);
    r1.getCell(1).value = new Date(Date.UTC(y, m, 1));
    r1.getCell(1).numFmt = 'mmmm yyyy';
    r1.getCell(1).font = { bold: true };
    const r2 = ws.getRow(2);
    r2.getCell(1).value = 'TECNICOS';
    r2.getCell(1).font = { bold: true };
    days.forEach((n, i) => {
      const c1 = r1.getCell(2 + i), c2 = r2.getCell(2 + i);
      c1.value = i + 1; c2.value = WD[E.weekday(n)];
      [c1, c2].forEach((c) => {
        c.alignment = { horizontal: 'center' }; c.font = { bold: true }; c.border = border;
        if (E.weekday(n) >= 5) c.fill = solid(FILL.weekend);
        else if (hol.has(E.isoOf(n))) c.fill = solid(FILL.holiday);
      });
    });

    let r = 3;
    const head = ws.getRow(r);
    ['HT', 'HORAS', 'V', 'B', 'T4'].forEach((h, k) => {
      const c = head.getCell(sumCol + k); c.value = h; c.font = { bold: true }; c.alignment = { horizontal: 'center' };
      c.fill = solid('FFFDE9D9');
    });

    for (const g of E.GROUPS) {
      const row = ws.getRow(r);
      row.getCell(1).value = E.GROUP_NAMES[g];
      row.getCell(1).font = { bold: true, color: { argb: g === 'N' ? 'FFFFFFFF' : 'FF000000' } };
      row.getCell(1).fill = solid(FILL[g]);
      r++;
      for (const p of people.filter((x) => x.group === g)) {
        const pr = ws.getRow(r);
        pr.getCell(1).value = p.name;
        pr.getCell(1).border = border;
        days.forEach((n, i) => {
          const code = sched.code(p.id, n);
          const c = pr.getCell(2 + i);
          c.value = code || null;
          c.alignment = { horizontal: 'center' };
          c.border = border;
          c.font = { size: 9 };
          const f = codeFill(code);
          if (f) c.fill = solid(f);
          else if (E.weekday(n) >= 5) c.fill = solid(FILL.weekend);
        });
        const s = E.personSummary(sched, p.id, days, state.settings.hoursPerShift || 8);
        [s.ht, s.horas, s.v, s.b, s.t4].forEach((v, k) => {
          const c = pr.getCell(sumCol + k); c.value = v; c.alignment = { horizontal: 'center' }; c.border = border;
        });
        r++;
      }
    }

    // Guardias
    const gr = ws.getRow(r);
    gr.getCell(1).value = 'GUARDIAS'; gr.getCell(1).font = { bold: true };
    days.forEach((n, i) => {
      const l = E.guardLetter(state.settings, n);
      const c = gr.getCell(2 + i); c.value = l; c.alignment = { horizontal: 'center' }; c.border = border;
      c.fill = solid(l === state.settings.guardLetters[0] ? 'FF00B0F0' : 'FFC5E0B4');
    });
    r++;

    const totals = days.map((n) => E.dayTotals(sched, people, n));
    const lines = [
      ['MAÑANA', (t) => t.M], ['TARDE', (t) => t.T], ['NOCHE', (t) => t.N], null,
      ['TERMINAL T2', (t) => t.T2], ['TERMINAL T4', (t) => t.T4], null, ['TOTAL Técnicos', (t) => t.total],
    ];
    for (const line of lines) {
      if (!line) { r++; continue; }
      const row = ws.getRow(r);
      row.getCell(1).value = line[0]; row.getCell(1).font = { bold: true };
      totals.forEach((t, i) => { const c = row.getCell(2 + i); c.value = line[1](t); c.alignment = { horizontal: 'center' }; c.font = { size: 9 }; });
      r++;
    }

    // Leyenda
    r++;
    const legend = [['M2/T2/N2', 'Terminal T2', FILL['2']], ['M4/T4/N4', 'Terminal T4', FILL['4']], ['MT4', 'Mañana/Tarde T4', null],
      ['V', 'Vacaciones', FILL.V], ['B', 'Baja', FILL.B], ['P', 'Permiso', FILL.P], ['FI', 'Falta injustificada', FILL.FI]];
    legend.forEach(([code, txt, f]) => {
      const row = ws.getRow(r++);
      row.getCell(2).value = code; if (f) row.getCell(2).fill = solid(f);
      row.getCell(2).alignment = { horizontal: 'center' };
      ws.mergeCells(r - 1, 3, r - 1, 8);
      row.getCell(3).value = txt;
    });
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 };
  }

  async function exportMonths(state, sched, months, monthNames, filename) {
    const wb = new root.ExcelJS.Workbook();
    wb.creator = 'Planillas de turnos';
    months.forEach(({ y, m }) => addMonth(wb, state, sched, y, m, monthNames[m]));
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  root.Exporter = { exportMonths, codeFill };
})(typeof window !== 'undefined' ? window : globalThis);
