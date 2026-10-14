import { jsPDF } from 'jspdf';

const ink = '#27313e';
const neutral = '#536171';

function answerFor(answers, question, index) {
  return answers[question.id] ?? answers[index];
}

function documentFor(orientation) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.setFont('helvetica');
  doc.setTextColor(ink);
  return doc;
}

function metadata(meta) {
  return [
    meta.company && `Gráfica: ${meta.company}`,
    meta.admin && `Administrador entrevistado: ${meta.admin}`,
    meta.director && `Diretor entrevistador: ${meta.director}`,
    meta.date && `Data: ${new Date(`${meta.date}T12:00:00`).toLocaleDateString('pt-BR')}`,
  ].filter(Boolean);
}

// Writes one line at a time so arbitrarily long notes continue on subsequent pages.
function textWriter(doc, initialY = 20) {
  let y = initialY;
  const width = doc.internal.pageSize.getWidth() - 36;
  const bottom = doc.internal.pageSize.getHeight() - 18;
  return {
    write(text, { size = 12, bold = false, gap = 4 } = {}) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const height = size * 0.3528 * 1.45;
      for (const line of doc.splitTextToSize(String(text), width)) {
        if (y + height > bottom) { doc.addPage(); y = 20; }
        doc.text(line, 18, y);
        y += height;
      }
      y += gap;
    },
  };
}

export function createInterviewPdf(meta, questions, answers) {
  const doc = documentFor('portrait');
  doc.setProperties({ title: 'Entrevista de requisitos da gráfica' });
  const writer = textWriter(doc);
  writer.write('ENTREVISTA DE REQUISITOS', { size: 17, bold: true, gap: 8 });
  metadata(meta).forEach(line => writer.write(line, { gap: 1 }));
  questions.forEach((question, i) => {
    const answer = answerFor(answers, question, i);
    if (!answer) return;
    writer.write(`${String(i + 1).padStart(2, '0')} · ${question.area}`, { bold: true, gap: 1 });
    writer.write(question.text, { bold: true, gap: 2 });
    writer.write(`Resposta: ${answer.value === 'sim' ? 'Sim' : 'Não'}`, { gap: answer.note ? 2 : 7 });
    if (answer.note) writer.write(`Observação: ${answer.note}`, { gap: 7 });
  });
  return doc;
}

export function createFlowPdf(meta, questions, answers) {
  const doc = documentFor('landscape');
  doc.setProperties({ title: 'Fluxograma da entrevista da gr\u00e1fica' });
  const blue = '#2563a5', navy = '#203d64';
  const center = 148.5, diamondWidth = 126, questionWidth = 86;
  const leading = 1.16;
  function lines(value, width, size = 11.5, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    return doc.splitTextToSize(String(value), width);
  }
  function height(value, width, size = 11.5, bold = false) {
    return lines(value, width, size, bold).length * size * 0.3528 * leading;
  }
  function text(value, x, y, width, size = 11.5, bold = false, color = ink, align = 'center') {
    const wrapped = lines(value, width, size, bold);
    doc.setTextColor(color);
    doc.text(wrapped, x, y, { align, lineHeightFactor: leading });
  }
  function connector(points, color = blue, arrow = false, weight = 0.75) {
    doc.setDrawColor(color); doc.setLineWidth(weight); doc.setLineJoin('round');
    for (let i = 1; i < points.length; i++) doc.line(...points[i - 1], ...points[i]);
    if (arrow) {
      const [ax, ay] = points.at(-2), [x, y] = points.at(-1);
      const angle = Math.atan2(y - ay, x - ax), length = 2.3, half = 1.1;
      doc.setFillColor(color);
      doc.triangle(x, y, x - length * Math.cos(angle) + half * Math.sin(angle), y - length * Math.sin(angle) - half * Math.cos(angle), x - length * Math.cos(angle) - half * Math.sin(angle), y - length * Math.sin(angle) + half * Math.cos(angle), 'F');
    }
  }
  function polygon(points, fill, stroke, weight = 0.6) {
    doc.setFillColor(fill); doc.setDrawColor(stroke); doc.setLineWidth(weight);
    doc.lines(points.slice(1).map((point, i) => [point[0] - points[i][0], point[1] - points[i][1]]), ...points[0], [1, 1], 'FD', true);
  }
  function pill(y, label) {
    doc.setFillColor('#e5edf7'); doc.roundedRect(center - 42 + 0.5, y + 0.7, 84, 7, 3.5, 3.5, 'F');
    doc.setFillColor('#dbeafe'); doc.setDrawColor(blue); doc.setLineWidth(0.6);
    doc.roundedRect(center - 42, y, 84, 7, 3.5, 3.5, 'FD');
    text(label, center, y + 4.8, 78, 10.5, true, navy);
  }
  const metaRows = metadata(meta);
  const metaHeights = metaRows.map(value => height(value, 132, 10));
  let metaHeight = 0;
  for (let i = 0; i < metaRows.length; i += 2) metaHeight += Math.max(metaHeights[i], metaHeights[i + 1] || 0) + 1;
  const terminalY = Math.max(25, 24 + metaHeight);
  const startY = terminalY + 9;
  // The diamond grows around the measured text, including its sloping edges.
  function layout(q, index) {
    const questionLines = lines(q.text, questionWidth, 11.5, true);
    const lineHeight = 11.5 * 0.3528 * leading;
    const fittedHeight = Math.max(...questionLines.map((line, i) => {
      const inset = 1 - (doc.getTextWidth(line) + 6) / diamondWidth;
      return 2 * (Math.abs((i - (questionLines.length - 1) / 2) * lineHeight) + 2.1) / inset;
    }));
    const branchWidth = 62, branchTextWidth = 50;
    const branchHeight = Math.max(24, height(q.yes, branchTextWidth, 11) + 11, height(q.no, branchTextWidth, 11) + 11);
    const dh = Math.max(32, fittedHeight, branchHeight + 2);
    const areaHeight = height(String(index + 1).padStart(2, '0') + ' \u00b7 ' + q.area, 180, 11, true);
    return { q, index, dh, areaHeight, branchHeight, branchWidth, branchTextWidth, h: areaHeight + 2 + dh + 6 };
  }
  const pages = [[]];
  let used = 0;
  questions.forEach((q, index) => {
    const item = layout(q, index);
    const page = pages.at(-1);
    if (page.length && (page.length === 3 || used + 6 + item.h > 190 - startY)) {
      pages.push([]); used = 0;
    }
    if (pages.at(-1).length) used += 6;
    pages.at(-1).push(item); used += item.h;
  });
  pages.forEach((page, pageIndex) => {
    if (pageIndex) doc.addPage('a4', 'landscape');
    doc.setFillColor(blue); doc.rect(0, 0, 297, 3, 'F');
    doc.setFillColor(navy); doc.roundedRect(10, 7, 277, 13, 2, 2, 'F');
    text('FLUXOGRAMA DA ENTREVISTA', 15, 15.6, 220, 17, true, '#ffffff', 'left');
    if (page.length) text(`Perguntas ${page[0].index + 1} a ${page.at(-1).index + 1}`, 282, 15, 60, 10, false, '#ffffff', 'right');
    let metaY = 25;
    for (let i = 0; i < metaRows.length; i += 2) {
      text(metaRows[i], 11, metaY, 132, 10, false, neutral, 'left');
      if (metaRows[i + 1]) text(metaRows[i + 1], 153, metaY, 132, 10, false, neutral, 'left');
      metaY += Math.max(metaHeights[i], metaHeights[i + 1] || 0) + 1;
    }
    pill(terminalY, pageIndex ? `Continua\u00e7\u00e3o \u00b7 pergunta ${page[0].index + 1}` : 'In\u00edcio da entrevista');
    let y = startY;
    let previousJoin = terminalY + 7;
    page.forEach(item => {
      const { q, index, dh, areaHeight, branchHeight, branchWidth, branchTextWidth } = item;
      const top = y + areaHeight + 2, cy = top + dh / 2;
      const joinY = top + dh + 6;
      // Leave an explicit break around the area title so no edge crosses text.
      if (y - previousJoin > 1) connector([[center, previousJoin], [center, y - 0.5]]);
      text(String(index + 1).padStart(2, '0') + ' \u00b7 ' + q.area, center, y + 3.4, 180, 11, true, navy);
      connector([[center, top - 1.5], [center, top]], blue, true);
      const diamond = [[center, top], [center + diamondWidth / 2, cy], [center, top + dh], [center - diamondWidth / 2, cy]];
      polygon(diamond.map(([x, y]) => [x + 0.65, y + 0.85]), '#ece3c9', '#ece3c9', 0.2);
      polygon(diamond, '#fff0b3', '#bd821d', 0.7);
      const qLines = lines(q.text, questionWidth, 11.5, true);
      text(q.text, center, cy - (qLines.length - 1) * 11.5 * 0.3528 * leading / 2 + 1.35, questionWidth, 11.5, true, '#553b12');
      const answer = answerFor(answers, q, index);
      ['sim', 'nao'].forEach((value, b) => {
        const x = b ? 223 : 12, bx = x + branchWidth / 2;
        const shapeY = cy - branchHeight / 2;
        const selected = answer?.value === value;
        const color = b ? '#b6314b' : '#187550';
        const fill = b ? '#ffe4eb' : '#dbf4e7';
        const edgeX = b ? x + 2 : x + branchWidth - 2;
        const diamondX = center + (b ? 1 : -1) * diamondWidth / 2;
        connector([[diamondX, cy], [edgeX, cy]], color, true, selected ? 1.25 : 0.7);
        text(b ? 'N\u00c3O' : 'SIM', (diamondX + edgeX) / 2, cy - 3, 18, 10.5, true, color);
        const shape = [[x + 4, shapeY], [x + branchWidth, shapeY], [x + branchWidth - 4, shapeY + branchHeight], [x, shapeY + branchHeight]];
        polygon(shape.map(([x, y]) => [x + 0.6, y + 0.8]), '#e4eaf0', '#e4eaf0', 0.2);
        polygon(shape, fill, color, selected ? 1.7 : 0.5);
        text(b ? q.no : q.yes, bx, shapeY + 4.6, branchTextWidth, 11);
        if (selected) text('Resposta registrada', bx, shapeY + branchHeight - 2.5, branchTextWidth, 10, true, color);
        connector([[bx, shapeY + branchHeight], [bx, joinY], [center, joinY]], color, false, selected ? 1.15 : 0.6);
      });
      doc.setFillColor(blue); doc.circle(center, joinY, 1.25, 'F');
      previousJoin = joinY;
      y = joinY + 6;
    });
    connector([[center, previousJoin], [center, previousJoin + 5]], blue, true);
    const next = pages[pageIndex + 1]?.[0];
    pill(previousJoin + 5, next ? `Continua na p\u00e1gina ${pageIndex + 2} \u00b7 pergunta ${next.index + 1}` : 'Fim da entrevista');
    text('Losango: decis\u00e3o \u00b7 Paralelogramo: registro \u00b7 Borda refor\u00e7ada: resposta registrada', 10, 205, 255, 10, false, neutral, 'left');
    text(`P\u00e1gina ${pageIndex + 1}/${pages.length}`, 287, 205, 30, 10, false, neutral, 'right');
  });
  return doc;
}

export function downloadPdf(mode, meta, questions, answers) {
  const doc = mode === 'flow' ? createFlowPdf(meta, questions, answers) : createInterviewPdf(meta, questions, answers);
  const name = mode === 'flow' ? 'fluxograma' : 'entrevista';
  return doc.save(`${name}-grafica-${meta.date || 'sem-data'}.pdf`, { returnPromise: true });
}
