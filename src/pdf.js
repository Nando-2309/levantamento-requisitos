import { jsPDF } from 'jspdf';

const ink = '#27313e';
const neutral = '#536171';
const green = '#238653';
const red = '#cc4c4c';

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
    write(text, { size = 10, bold = false, gap = 4 } = {}) {
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
  doc.setProperties({ title: 'Fluxograma da entrevista da gráfica' });
  const pageCount = Math.max(1, Math.ceil(questions.length / 9));
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const offset = pageIndex * 9;
    const pageQuestions = questions.slice(offset, offset + 9);
    if (pageIndex > 0) doc.addPage('a4', 'landscape');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('FLUXOGRAMA DA ENTREVISTA', 148.5, 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Perguntas ${offset + 1} a ${offset + pageQuestions.length} de ${questions.length} · Página ${pageIndex + 1}/${pageCount}`, 148.5, 20, { align: 'center' });
    const writer = textWriter(doc, 27);
    metadata(meta).forEach(line => writer.write(line, { size: 9, gap: 1 }));
    // Extensive participant data receives its own page rather than overlapping the diagram.
    const metaLines = metadata(meta).reduce((n, line) => n + doc.splitTextToSize(line, 261).length, 0);
    if (metaLines > 5) doc.addPage('a4', 'landscape');
    const top = metaLines > 5 ? 14 : 27 + metaLines * 5.7;
    const scale = Math.min(277 / 1500, (198 - top) / 1040);
    const left = (297 - 1500 * scale) / 2;
    const point = (x, y) => [left + x * scale, top + y * scale];
    function line(points, color = neutral, arrow = false) {
      doc.setDrawColor(color);
      doc.setLineWidth(1.4 * scale);
      for (let i = 1; i < points.length; i++) {
        const a = point(...points[i - 1]);
        const b = point(...points[i]);
        doc.line(...a, ...b);
      }
      if (arrow) {
        const [ax, ay] = points[points.length - 2];
        const [bx, by] = points[points.length - 1];
        const angle = Math.atan2(by - ay, bx - ax);
        const end = point(bx, by);
        const a = point(bx - 8 * Math.cos(angle) + 4 * Math.sin(angle), by - 8 * Math.sin(angle) - 4 * Math.cos(angle));
        const b = point(bx - 8 * Math.cos(angle) - 4 * Math.sin(angle), by - 8 * Math.sin(angle) + 4 * Math.cos(angle));
        doc.setFillColor(color);
        doc.triangle(...end, ...a, ...b, 'F');
      }
    }
    function label(text, x, y, width, { size = 13, bold = false, color = ink, maxLines = 0 } = {}) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size * scale * 2.83465);
      doc.setTextColor(color);
      let lines = doc.splitTextToSize(text, width * scale);
      if (maxLines && lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        const last = lines.length - 1;
        lines[last] = lines[last].slice(0, -3).trimEnd() + '...';
      }
      lines.forEach((text, i) => doc.text(text, ...point(x, y + (i - (lines.length - 1) / 2) * 15), { align: 'center' }));
    }
    function box(x, y, w, h, fill, stroke, selected = false, radius = 7) {
      doc.setFillColor(fill);
      doc.setDrawColor(stroke);
      doc.setLineWidth((selected ? 2.5 : 1.2) * scale);
      doc.roundedRect(...point(x, y), w * scale, h * scale, radius * scale, radius * scale, 'FD');
    }
    function terminal(x, y, text) {
      doc.setFillColor('#eaf0fa'); doc.setDrawColor(neutral); doc.setLineWidth(1.4 * scale);
      doc.ellipse(...point(x, y + 20), 108 * scale, 20 * scale, 'FD');
      label(text, x, y + 24, 190, { size: 12, bold: true });
    }
    function record(x, y, fill, stroke, chosen) {
      doc.setFillColor(fill); doc.setDrawColor(stroke); doc.setLineWidth((chosen ? 2.5 : 1.2) * scale);
      doc.lines([[192 * scale, 0], [-18 * scale, 58 * scale], [-192 * scale, 0], [18 * scale, -58 * scale]], ...point(x + 18, y), [1, 1], 'FD', true);
    }
    const positions = pageQuestions.map((_, i) => {
      const row = Math.floor(i / 3);
      return { x: 250 + (row % 2 ? 2 - i % 3 : i % 3) * 500, y: 130 + row * 310 };
    });
    terminal(250, 0, pageIndex ? 'Continuação da entrevista' : 'Início da entrevista');
    line([[250, 64], [250, 70]], neutral, true);
    positions.slice(0, -1).forEach((p, i) => {
      const next = positions[i + 1];
      const side = Math.floor(i / 3) % 2 ? next.x + 235 : next.x - 235;
      if (p.y === next.y) {
        line([[p.x, p.y + 150], [side, p.y + 150], [side, next.y], [next.x + (side < next.x ? -122 : 122), next.y]], neutral, true);
      } else {
        // Leave a gap for the area title instead of drawing through its text.
        line([[p.x, p.y + 150], [p.x, next.y - 92]]);
        line([[p.x, next.y - 66], [p.x, next.y - 60]], neutral, true);
      }
    });
    pageQuestions.forEach((q, i) => {
      const { x, y } = positions[i];
      const answer = answerFor(answers, q, offset + i);
      label(`${String(offset + i + 1).padStart(2, '0')} · ${q.area}`, x, y - 72, 400, { size: 12, bold: true, color: neutral, maxLines: 1 });
      doc.setFillColor('#fff6df');
      doc.setDrawColor('#434d5a');
      doc.setLineWidth(1.7 * scale);
      doc.lines([[122 * scale, 60 * scale], [-122 * scale, 60 * scale], [-122 * scale, -60 * scale], [122 * scale, -60 * scale]], ...point(x, y - 60), [1, 1], 'FD', true);
      label(q.text, x, y + 2, 168, { size: 12, bold: true, maxLines: 4 });
      ['sim', 'nao'].forEach((value, b) => {
        const bx = x + (b ? 119 : -119);
        const color = b ? red : green;
        const chosen = answer?.value === value;
        line([[x + (b ? 68 : -68), y + 27], [bx, y + 27], [bx, y + 78]], color, true);
        label(b ? 'NÃO' : 'SIM', bx + (b ? 20 : -20), y + 57, 80, { size: 12, bold: true, color });
        record(bx - 105, y + 80, chosen ? (b ? '#fceceb' : '#e8f5ed') : '#f1f3f6', chosen ? color : neutral, chosen);
        label(b ? q.no : q.yes, bx, y + 104, 171, { size: 12, maxLines: 3 });
        if (chosen) label('Resposta registrada', bx, y + 132, 195, { size: 10, bold: true, color });
        if (chosen && answer.note) {
          box(bx + 79, y + 65, 24, 30, '#ffffff', color, false, 1);
          line([[bx + 84, y + 74], [bx + 98, y + 74]], color);
          line([[bx + 84, y + 81], [bx + 98, y + 81]], color);
          label('Obs.', bx + 91, y + 92, 22, { size: 7, color });
        }
        line([[bx, y + 138], [bx, y + 150], [x, y + 150]]);
      });
      doc.setFillColor('#ffffff'); doc.setDrawColor(neutral); doc.setLineWidth(1.4 * scale);
      doc.circle(...point(x, y + 150), 5 * scale, 'FD');
    });
    const last = positions.at(-1) || { x: 250, y: 130 };
    line([[last.x, last.y + 150], [last.x, last.y + 202]], neutral, true);
    terminal(last.x, last.y + 204, pageIndex === pageCount - 1 ? 'Fim da entrevista' : `Continua na página ${pageIndex + 2}`);
    label('Oval: início/fim · Losango: decisão · Paralelogramo: registro · Círculo: conexão · Obs.: observação no anexo', 750, 1015, 1400, { size: 11, color: neutral });
  }
  const details = questions.flatMap((q, i) => {
    const answer = answerFor(answers, q, i);
    return q.id?.startsWith('custom-') || answer?.note ? [{ ...q, index: i, ...answer }] : [];
  });
  if (details.length) {
    doc.addPage('a4', 'portrait');
    doc.setTextColor(ink);
    const notesWriter = textWriter(doc);
    notesWriter.write('DETALHES E OBSERVAÇÕES', { size: 16, bold: true, gap: 8 });
    details.forEach(item => {
      notesWriter.write(`${String(item.index + 1).padStart(2, '0')} · ${item.area}`, { bold: true, gap: 2 });
      notesWriter.write(item.text, { gap: 2 });
      notesWriter.write(`Resposta: ${item.value ? (item.value === 'sim' ? 'Sim' : 'Não') : 'Não registrada'}`, { gap: 2 });
      notesWriter.write(`Caminho Sim: ${item.yes}`, { gap: 1 });
      notesWriter.write(`Caminho Não: ${item.no}`, { gap: 2 });
      if (item.note) notesWriter.write(`Observação: ${item.note}`, { gap: 7 });
    });
  }
  return doc;
}

export function downloadPdf(mode, meta, questions, answers) {
  const doc = mode === 'flow' ? createFlowPdf(meta, questions, answers) : createInterviewPdf(meta, questions, answers);
  const name = mode === 'flow' ? 'fluxograma' : 'entrevista';
  return doc.save(`${name}-grafica-${meta.date || 'sem-data'}.pdf`, { returnPromise: true });
}
