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
  return [...source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => {
    const data = Buffer.from(match[1], 'latin1');
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
      assert.equal(doc.getNumberOfPages(), 1);
      assert.ok(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight());
      assert.equal((text.match(/Resposta registrada/g) || []).length, 9);
    } else {
      assert.match(text, /Resposta: Sim/);
      assert.match(text, /Resposta: Não/);
    }
    console.log(`${mode}: ${(performance.now() - start).toFixed(1)} ms`);
  }
});

test('long notes paginate and retain their final text in both exports', () => {
  const longAnswers = { ...answers, 0: { value: 'sim', note: `${'Observação com acentos: aprovação e produção. '.repeat(600)}FIM_DA_OBSERVACAO` } };
  for (const generate of [createInterviewPdf, createFlowPdf]) {
    const doc = generate(meta, questions, longAnswers);
    assert.ok(doc.getNumberOfPages() > 1);
    assert.match(content(doc), /FIM_DA_OBSERVACAO/);
  }
});

test('partial interview highlights only recorded responses', () => {
  const doc = createFlowPdf(meta, questions, { 2: answers[2] });
  assert.equal((content(doc).match(/Resposta registrada/g) || []).length, 1);
  assert.equal(doc.getNumberOfPages(), 1);
});

test('custom questions paginate the diagram and preserve full question and note text', () => {
  const custom = Array.from({ length: 12 }, (_, i) => ({ id: `custom-${i}`, type: 'binary', area: 'Revisão', text: `A gráfica registra a etapa adicional de revisão ${i + 1}?`, yes: 'Etapa registrada', no: 'Etapa não registrada' }));
  const allQuestions = [...questions, ...custom];
  const stableAnswers = Object.fromEntries(allQuestions.map(q => [q.id, { value: 'sim', note: q.id === 'custom-11' ? 'NOTA_DA_ULTIMA_PERGUNTA' : '' }]));
  const flow = createFlowPdf(meta, allQuestions, stableAnswers);
  const text = content(flow);
  assert.ok(flow.getNumberOfPages() >= 4);
  assert.equal((text.match(/Resposta registrada/g) || []).length, 21);
  assert.match(text, /Perguntas 19 a 21 de 21/);
  assert.match(text, /NOTA_DA_ULTIMA_PERGUNTA/);
  const interview = createInterviewPdf(meta, allQuestions, stableAnswers);
  assert.match(content(interview), /NOTA_DA_ULTIMA_PERGUNTA/);
});
