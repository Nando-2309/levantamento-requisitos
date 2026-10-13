import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySession, loadSession, removeUnansweredQuestion, validateQuestion } from '../src/session.js';
import { questions } from '../src/questions.js';

const custom = { id: 'custom-test', type: 'binary', area: 'Acabamento', text: 'A gráfica registra a revisão do acabamento?', yes: 'Revisão registrada', no: 'Revisão não registrada' };

test('question bank and interview survive reload with stable response IDs', () => {
  const session = { ...emptySession(), version: 1, customQuestions: [custom], answers: { [custom.id]: { value: 'nao', note: 'Informação confirmada na visita.' } }, step: 9 };
  const loaded = loadSession({ getItem: () => JSON.stringify(session) });
  assert.deepEqual(loaded.customQuestions, [custom]);
  assert.equal(loaded.answers[custom.id].note, 'Informação confirmada na visita.');
  assert.equal(loaded.step, 9);
});

test('deleting an earlier unanswered question keeps the current question and responses', () => {
  const second = { ...custom, id: 'custom-second', text: 'A gráfica registra as etapas de revisão?' };
  const session = { ...emptySession(), customQuestions: [custom, second], step: 10, answers: { [second.id]: { value: 'sim', note: 'Responsável identificado.' } } };
  const next = removeUnansweredQuestion(session, custom.id, [...questions, custom, second]);
  assert.equal(next.step, 9);
  assert.equal(next.customQuestions[0].id, second.id);
  assert.deepEqual(next.answers, session.answers);
  assert.throws(() => removeUnansweredQuestion(next, second.id, [...questions, second]));
});

test('question validation rejects empty values and duplicate questions', () => {
  assert.ok(validateQuestion({ ...custom, text: ' ' }, questions));
  assert.ok(validateQuestion({ ...custom, text: `  ${questions[0].text.toUpperCase()}  ` }, questions));
  assert.equal(validateQuestion(custom, questions), '');
});
