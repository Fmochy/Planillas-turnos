// Exporta uno o varios meses a .xlsx (una pestaña por mes) con formato de cuadrante.
(function (root) {
  'use strict';
  const E = root.Engine;

  const C = {
    navy: 'FF1F3864', navyText: 'FFFFFFFF', headWe: 'FF44546A', headHol: 'FFC00000',
    t2: 'FF00B050', t4: 'FFFFFF00', v: 'FFFF0000', b: 'FF00B0F0', p: 'FFFFC000', fi: 'FF7F7F7F',
    lv: 'FFDDEBF7', zebra: 'FFF5F7FA', we: 'FFE4E7EC', hol: 'FFF8DCDC',
    secM: 'FF00B0F0', secT: 'FFFFFF00', secN: 'FF7030A0',
    sumHead: 'FFF4B183', sumBody: 'FFFBE5D6', totBody: 'FFF2F2F2', totHead: 'FFD6DCE4',
    guardA: 'FF00B0F0', guardB: 'FFA9D08E', line: 'FFB4BCC8', strong: 'FF1F3864',
  };
  const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const side = (argb, style) => ({ style: style || 'thin', color: { argb: argb || C.line } });
  const box = (argb) => ({ top: side(argb), left: side(argb), bottom: side(argb), right: side(argb) });
  const center = { horizontal: 'center', vertical: 'middle' };
  const FONT = 'Calibri';

  function codeFill(code) {
    if (!code) return null;
    if (E.isShift(code)) return E.terminalOf(code) === '4' ? C.t4 : C.t2;
    return { V: C.v, B: C.b, P: C.p, FI: C.fi }[code] || null;
  }
  const whiteText = (code) => code === 'V' || code === 'FI';

  function addMonth(wb, state, sched, y, m, monthName) {
    const ws = wb.addWorksheet(`${monthName} ${y}`, {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 3, showGridLines: false }],
      properties: { tabColor: { argb: [C.secM, C.t2, C.t4, C.secN][m % 4] } },
    });
    const nd = E.daysInMonth(y, m);
    const start = E.dn(y, m, 1);
    const days = Array.from({ length: nd }, (_, i) => start + i);
    const hol = new Set(state.holidays);
    const people = state.people.filter((p) => p.active !== false);
    const lastDayCol = nd + 1;
    const sumCol = nd + 3;
    const lastCol = sumCol + 4;
    const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    // Festivos con el mismo gris que los fines de semana
    const isWe = (n) => E.weekday(n) >= 5 || hol.has(E.isoOf(n));

    ws.getColumn(1).width = 28;
    for (let i = 0; i < nd; i++) ws.getColumn(2 + i).width = 5;
    ws.getColumn(nd + 2).width = 2;
    for (let k = 0; k < 5; k++) ws.getColumn(sumCol + k).width = 7.5;

    // Título
    ws.mergeCells(1, 1, 1, lastCol);
    const title = ws.getCell(1, 1);
    title.value = `CUADRANTE DE TÉCNICOS · ${monthName.toUpperCase()} ${y}`;
    title.font = { name: FONT, size: 15, bold: true, color: { argb: C.navyText } };
    title.fill = solid(C.navy);
    title.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 30;

    // Cabecera de días
    const r2 = ws.getRow(2), r3 = ws.getRow(3);
    r2.height = 18; r3.height = 16;
    const hc = (cell, txt, fill, size) => {
      cell.value = txt; cell.fill = solid(fill); cell.alignment = center;
      cell.font = { name: FONT, bold: true, size: size || 10, color: { argb: C.navyText } };
      cell.border = box('FF8497B0');
    };
    hc(r2.getCell(1), 'TÉCNICOS', C.navy, 11);
    hc(r3.getCell(1), '', C.navy);
    ws.mergeCells(2, 1, 3, 1);
    r2.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    days.forEach((n, i) => {
      const f = isWe(n) ? C.headWe : C.navy;
      hc(r2.getCell(2 + i), i + 1, f, 10);
      hc(r3.getCell(2 + i), WD[E.weekday(n)], f, 8);
    });
    ['HT', 'HORAS', 'V', 'B', 'T4'].forEach((h, k) => {
      hc(r2.getCell(sumCol + k), h, C.sumHead, 9);
      r2.getCell(sumCol + k).font = { name: FONT, bold: true, size: 9, color: { argb: 'FF000000' } };
      hc(r3.getCell(sumCol + k), '', C.sumHead);
      ws.mergeCells(2, sumCol + k, 3, sumCol + k);
    });

    let r = 4;
    for (const g of E.GROUPS) {
      const row = ws.getRow(r); row.height = 17;
      const secFill = { M: C.secM, T: C.secT, N: C.secN }[g];
      for (let c = 1; c <= lastDayCol; c++) { row.getCell(c).fill = solid(secFill); row.getCell(c).border = { top: side(C.strong, 'medium') }; }
      row.getCell(1).value = E.GROUP_NAMES[g];
      row.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: g === 'N' ? 'FFFFFFFF' : 'FF000000' } };
      row.getCell(1).alignment = { vertical: 'middle', indent: 1 };
      r++;
      people.filter((x) => x.group === g).forEach((p, idx) => {
        const pr = ws.getRow(r); pr.height = 17;
        const base = p.type === 'lv' ? C.lv : idx % 2 ? C.zebra : null;
        const nameCell = pr.getCell(1);
        nameCell.value = p.type === 'lv' ? `${p.name}  (L-V)` : p.name;
        nameCell.font = { name: FONT, size: 10, bold: p.type === 'lv' };
        nameCell.alignment = { vertical: 'middle', indent: 1 };
        nameCell.border = box();
        if (base) nameCell.fill = solid(base);
        days.forEach((n, i) => {
          const code = sched.code(p.id, n);
          const c = pr.getCell(2 + i);
          c.value = code || null;
          c.alignment = center;
          c.border = box();
          c.font = { name: FONT, size: 9, bold: !!code, color: { argb: whiteText(code) ? 'FFFFFFFF' : 'FF000000' } };
          const f = codeFill(code) || (isWe(n) ? C.we : base);
          if (f) c.fill = solid(f);
        });
        const s = E.personSummary(sched, p.id, days, state.settings.hoursPerShift || 8, hol);
        [s.ht, s.horas, s.v, s.b, s.t4].forEach((v, k) => {
          const c = pr.getCell(sumCol + k);
          c.value = v; c.alignment = center; c.border = box(); c.fill = solid(C.sumBody);
          c.font = { name: FONT, size: 9, bold: k === 0 };
        });
        r++;
      });
    }

    // Guardias
    const gr = ws.getRow(r); gr.height = 18;
    const gname = gr.getCell(1);
    gname.value = 'GUARDIAS'; gname.font = { name: FONT, bold: true, size: 10, color: { argb: C.navyText } };
    gname.fill = solid(C.navy); gname.alignment = { vertical: 'middle', indent: 1 }; gname.border = box();
    days.forEach((n, i) => {
      const l = E.guardLetter(state.settings, n);
      const c = gr.getCell(2 + i);
      c.value = l; c.alignment = center; c.font = { name: FONT, bold: true, size: 10 };
      c.fill = solid(l === state.settings.guardLetters[0] ? C.guardA : C.guardB);
      c.border = { ...box(), top: side(C.strong, 'medium') };
    });
    r += 2;

    // Totales diarios
    const totals = days.map((n) => E.dayTotals(sched, people, n));
    const lines = [
      ['Mañana', (t) => t.M], ['Tarde', (t) => t.T], ['Noche', (t) => t.N],
      ['Terminal T2', (t) => t.T2], ['Terminal T4', (t) => t.T4], ['TOTAL TÉCNICOS', (t) => t.total],
    ];
    lines.forEach(([label, fn], li) => {
      const row = ws.getRow(r);
      const strong = li === lines.length - 1;
      const lc = row.getCell(1);
      lc.value = label; lc.fill = solid(C.totHead); lc.border = box();
      lc.font = { name: FONT, bold: true, size: 9 }; lc.alignment = { vertical: 'middle', indent: 1 };
      totals.forEach((t, i) => {
        const c = row.getCell(2 + i);
        c.value = fn(t); c.alignment = center; c.border = box();
        c.fill = solid(strong ? C.totHead : C.totBody);
        c.font = { name: FONT, size: 9, bold: strong };
      });
      if (li === 3 || strong) for (let c = 1; c <= lastDayCol; c++) row.getCell(c).border = { ...box(), top: side(C.strong, 'medium') };
      r++;
    });

    // Leyenda
    r++;
    const lt = ws.getRow(r++).getCell(1);
    lt.value = 'LEYENDA'; lt.font = { name: FONT, bold: true, size: 10, color: { argb: C.strong } };
    const legend = [['M2', 'Terminal 2 (M2 · T2 · N2)', C.t2], ['M4', 'Terminal 4 (M4 · T4 · N4 · MT4)', C.t4],
      ['V', 'Vacaciones', C.v], ['B', 'Baja', C.b], ['P', 'Permiso', C.p], ['FI', 'Falta injustificada', C.fi],
      ['', 'Lunes a viernes', C.lv], ['', 'Fin de semana o festivo', C.we]];
    legend.forEach(([code, txt, f], i) => {
      const row = ws.getRow(r + Math.floor(i / 2));
      const col = 2 + (i % 2) * 9;
      const c = row.getCell(col);
      c.value = code; c.fill = solid(f); c.alignment = center; c.border = box();
      c.font = { name: FONT, bold: true, size: 9, color: { argb: whiteText(code) ? 'FFFFFFFF' : 'FF000000' } };
      ws.mergeCells(row.number, col + 1, row.number, col + 7);
      const tcell = row.getCell(col + 1);
      tcell.value = txt; tcell.font = { name: FONT, size: 9 }; tcell.alignment = { vertical: 'middle', indent: 1 };
    });

    ws.pageSetup = {
      orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1,
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
      horizontalCentered: true,
    };
  }

  // Pestaña de resumen anual: días, horas, vacaciones, bajas, permisos, faltas y T4 por persona
  function addSummary(wb, state, sched, y) {
    const ws = wb.addWorksheet(`Resumen ${y}`, {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 2, showGridLines: false }],
      properties: { tabColor: { argb: C.strong } },
    });
    const cols = [
      ['Persona', 30], ['Días trabajados', 11], ['Horas trabajadas', 11], ['Horas cómputo', 11], ['Vacaciones', 11],
      ['Cupo', 8], ['Quedan', 8], ['Bajas', 8], ['Permisos', 9], ['Faltas', 8], ['Finde / festivos', 11], ['Días T4', 9], ['% T4', 8],
    ];
    cols.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
    ws.mergeCells(1, 1, 1, cols.length);
    const t = ws.getCell(1, 1);
    t.value = `RESUMEN ANUAL ${y}`;
    t.font = { name: FONT, size: 15, bold: true, color: { argb: C.navyText } };
    t.fill = solid(C.navy); t.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 30;
    const hr = ws.getRow(2); hr.height = 30;
    cols.forEach(([h], i) => {
      const c = hr.getCell(i + 1);
      c.value = h; c.fill = solid(C.navy); c.border = box('FF8497B0');
      c.font = { name: FONT, bold: true, size: 10, color: { argb: C.navyText } };
      c.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle', wrapText: true, indent: i ? 0 : 1 };
    });
    const rows = E.yearSummary(state, sched, y);
    let r = 3;
    const tot = { work: 0, horasTrab: 0, horas: 0, v: 0, b: 0, p: 0, fi: 0, fest: 0, t4: 0 };
    for (const g of E.GROUPS) {
      const gr = rows.filter((x) => x.p.group === g);
      if (!gr.length) continue;
      const row = ws.getRow(r++); row.height = 18;
      for (let c = 1; c <= cols.length; c++) row.getCell(c).fill = solid({ M: C.secM, T: C.secT, N: C.secN }[g]);
      row.getCell(1).value = E.GROUP_NAMES[g];
      row.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: g === 'N' ? 'FFFFFFFF' : 'FF000000' } };
      row.getCell(1).alignment = { vertical: 'middle', indent: 1 };
      gr.forEach((x, idx) => {
        const s = x.s; const lv = x.p.type === 'lv';
        Object.keys(tot).forEach((k) => { tot[k] += s[k]; });
        const vals = [lv ? `${x.p.name}  (L-V)` : x.p.name, s.work, s.horasTrab, s.horas, s.v, x.quota, x.left, s.b, s.p, s.fi, s.fest,
          lv ? '—' : s.t4, lv ? '—' : Math.round(x.pct) / 100];
        const pr = ws.getRow(r++); pr.height = 17;
        const base = lv ? C.lv : idx % 2 ? C.zebra : null;
        vals.forEach((v, i) => {
          const c = pr.getCell(i + 1);
          c.value = v; c.border = box();
          c.font = { name: FONT, size: 10, bold: i === 0 && lv };
          c.alignment = i ? center : { vertical: 'middle', indent: 1 };
          if (base) c.fill = solid(base);
        });
        pr.getCell(13).numFmt = '0%';
        const left = pr.getCell(7);
        if (x.left < 0) { left.fill = solid('FFF8CBAD'); left.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFC00000' } }; }
        else if (x.left <= 3) left.fill = solid('FFFFE699');
      });
    }
    const fr = ws.getRow(r); fr.height = 20;
    const fv = [`TOTAL (${rows.length} personas)`, tot.work, tot.horasTrab, tot.horas, tot.v, '', '', tot.b, tot.p, tot.fi, tot.fest, tot.t4, ''];
    fv.forEach((v, i) => {
      const c = fr.getCell(i + 1);
      c.value = v; c.fill = solid(C.totHead); c.font = { name: FONT, bold: true, size: 10 };
      c.alignment = i ? center : { vertical: 'middle', indent: 1 };
      c.border = { ...box(), top: side(C.strong, 'medium') };
    });
    const note = ws.getRow(r + 2).getCell(1);
    note.value = 'Horas cómputo = (días trabajados + bajas) × horas por turno, como en el cuadrante original. Finde / festivos = días trabajados en sábado, domingo o festivo.';
    note.font = { name: FONT, size: 9, italic: true, color: { argb: 'FF595959' } };
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true };
  }

  async function exportMonths(state, sched, months, monthNames, filename, summaryYears) {
    const wb = new root.ExcelJS.Workbook();
    wb.creator = 'Planillas de turnos';
    wb.created = new Date();
    const years = [...new Set([...(summaryYears || [])])].sort();
    years.forEach((y) => {
      addSummary(wb, state, sched, y);
      months.filter((x) => x.y === y).forEach(({ m }) => addMonth(wb, state, sched, y, m, monthNames[m]));
    });
    months.filter((x) => !years.includes(x.y)).forEach(({ y, m }) => addMonth(wb, state, sched, y, m, monthNames[m]));
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
