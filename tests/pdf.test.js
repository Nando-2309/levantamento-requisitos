import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createInterviewPdf, createFlowPdf } from '../src/pdf.js';
import { questions } from '../src/questions.js';

const meta = { company: 'Gráfica São João', admin: 'José', director: 'Márcia', date: '2026-10-13' };
const answers = Object.fromEntries(questions.map((q, i) => [i, { value: i % 2 ? 'nao' : 'sim', note: '' }]));

function content(doc) {
  const bytes = Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const source = bytes.toString('latin1');
  return [...source.matchAll(/\/Length (\d+)[\s\S]*?stream\r?\n/g)].map(match => {
    const start = match.index + match[0].length;
    const data = bytes.subarray(start, start + Number(match[1]));
    try { return inflateSync(data).toString('latin1'); } catch { return data.toString('latin1'); }
  }).join('\n');
}

test('both exports generate valid, small PDFs without a browser or network', () => {
  for (const [mode, generate] of [['interview', createInterviewPdf], ['flow', createFlowPdf]]) {
    const start = performance.now();
    const doc = generate(meta, questions, answers);
    const text = content(doc);
    assert.match(text, /Gráfica São João/);
    assert.match(text, /13\/10\/2026/);
    assert.ok(doc.output('arraybuffer').byteLength < 100000);
    if (mode === 'flow') {
      assert.equal(doc.getNumberOfPages(), 3);
      assert.ok(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight());
      assert.equal((text.match(/Resposta registrada/g) || []).length, 9);
      const fontSizes = [...text.matchAll(/([\d.]+) Tf/g)].map(match => Number(match[1]));
      assert.ok(fontSizes.length > 0 && fontSizes.every(size => size >= 10), 'Flow text must stay at least 10 pt');
    } else {
      assert.match(text, /Resposta: Sim/);
      assert.match(text, /Resposta: Não/);
    }
    console.log(`${mode}: ${(performance.now() - start).toFixed(1)} ms`);
  }
});

test('long notes paginate only the interview and never enter the flow PDF', () => {
  const longAnswers = { ...answers, 0: { value: 'sim', note: `${'Observação com acentos: aprovação e produção. '.repeat(600)}FIM_DA_OBSERVACAO` } };
  const interview = createInterviewPdf(meta, questions, longAnswers);
  assert.ok(interview.getNumberOfPages() > 1);
  assert.match(content(interview), /FIM_DA_OBSERVACAO/);
  const flow = createFlowPdf(meta, questions, longAnswers);
  assert.equal(flow.getNumberOfPages(), 3);
  assert.doesNotMatch(content(flow), /FIM_DA_OBSERVACAO|DETALHES E OBSERVA/);
  assert.equal(content(flow), content(createFlowPdf(meta, questions, answers)));
});

test('partial interview includes only recorded questions with their original numbering', () => {
  const doc = createFlowPdf(meta, questions, { 2: answers[2] });
  assert.equal((content(doc).match(/Resposta registrada/g) || []).length, 1);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.match(content(doc), /Perguntas 3 a 3/);
  assert.doesNotMatch(content(doc), /Perguntas 1 a|Continua na/);
});

test('early export stops at the last recorded answer and paginates only those questions', () => {
  for (const count of [1, 3, 4, 8]) {
    const recorded = Object.fromEntries(questions.slice(0, count).map(q => [q.id, { value: 'sim' }]));
    const doc = createFlowPdf(meta, questions, recorded);
    const expected = createFlowPdf(meta, questions.slice(0, count), recorded);
    assert.equal(content(doc), content(expected));
    assert.equal(doc.getNumberOfPages(), Math.ceil(count / 3));
    assert.equal((content(doc).match(/Resposta registrada/g) || []).length, count);
    assert.match(content(doc), /Fim da entrevista/);
  }
});

test('export before the first answer contains no question nodes', () => {
  const text = content(createFlowPdf(meta, questions, {}));
  assert.doesNotMatch(text, /Perguntas |Resposta registrada|Continua na/);
  assert.match(text, /Fim da entrevista/);
});

test('custom questions paginate the diagram while notes stay in the interview', () => {
  const custom = Array.from({ length: 12 }, (_, i) => ({ id: `custom-${i}`, type: 'binary', area: 'Revisão', text: `A gráfica registra a etapa adicional de revisão ${i + 1}?`, yes: 'Etapa registrada', no: 'Etapa não registrada' }));
  const allQuestions = [...questions, ...custom];
  const stableAnswers = Object.fromEntries(allQuestions.map(q => [q.id, { value: 'sim', note: q.id === 'custom-11' ? 'NOTA_DA_ULTIMA_PERGUNTA' : '' }]));
  const flow = createFlowPdf(meta, allQuestions, stableAnswers);
  const text = content(flow);
  assert.equal(flow.getNumberOfPages(), 7);
  assert.equal((text.match(/Resposta registrada/g) || []).length, 21);
  assert.match(text, /Perguntas 19 a 21/);
  assert.doesNotMatch(text, /NOTA_DA_ULTIMA_PERGUNTA/);
  const interview = createInterviewPdf(meta, allQuestions, stableAnswers);
  assert.match(content(interview), /NOTA_DA_ULTIMA_PERGUNTA/);
});

test('date-only metadata shares the first diagram page without a cover or summary', () => {
  const doc = createFlowPdf({ date: meta.date }, questions, answers);
  assert.equal(doc.getNumberOfPages(), 3);
  const text = content(doc);
  assert.match(text, /13\/10\/2026/);
  assert.match(text, /Perguntas 1 a 3/);
  assert.match(text, /Perguntas 7 a 9/);
  assert.doesNotMatch(text, /DADOS DA ENTREVISTA|DETALHES E OBSERVA/);
});

test('long custom node labels remain complete without shrinking text or adding a summary', () => {
  const custom = {
    id: 'custom-long', area: 'Revisão de arquivos e acabamento',
    text: 'A gráfica registra a revisão dos arquivos e o acabamento dos impressos? '.repeat(4) + 'FIM_PERGUNTA',
    yes: 'A gráfica registra os arquivos revisados e as etapas de acabamento. FIM_SIM',
    no: 'A gráfica acompanha a revisão e o acabamento fora do sistema. FIM_NAO',
  };
  const text = content(createFlowPdf(meta, [...questions, custom], { ...answers, [custom.id]: { value: 'sim' } }));
  for (const marker of ['FIM_PERGUNTA', 'FIM_SIM', 'FIM_NAO']) assert.ok(text.includes(marker));
  const fontSizes = [...text.matchAll(/([\d.]+) Tf/g)].map(match => Number(match[1]));
  assert.ok(fontSizes.every(size => size >= 10));
  assert.doesNotMatch(text, /consulte os detalhes|DETALHES E OBSERVA/);
});
