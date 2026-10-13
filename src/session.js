export const STORAGE_KEY = 'graficafluxo-session-v1';

export function emptySession() {
  return {
    customQuestions: [], answers: {}, step: 0, finished: false,
    meta: { company: '', admin: '', director: '', date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) },
  };
}

export function loadSession(storage) {
  const fallback = emptySession();
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  const saved = JSON.parse(raw);
  if (!saved || saved.version !== 1) return fallback;
  const ids = new Set();
  const customQuestions = Array.isArray(saved.customQuestions) ? saved.customQuestions.filter(q => {
    if (!q || typeof q.id !== 'string' || !q.id.startsWith('custom-') || ids.has(q.id)) return false;
    if (q.type !== 'binary' || !['area', 'text'].every(key => typeof q[key] === 'string' && q[key].trim())) return false;
    if (q.type === 'binary' && !['yes', 'no'].every(key => typeof q[key] === 'string' && q[key].trim())) return false;
    ids.add(q.id);
    return true;
  }) : [];
  const answers = {};
  if (saved.answers && typeof saved.answers === 'object') {
    for (const [id, answer] of Object.entries(saved.answers)) {
      if (!answer || !['sim', 'nao'].includes(answer.value)) continue;
      answers[id] = { ...answer, note: typeof answer.note === 'string' ? answer.note : '' };
    }
  }
  const meta = Object.fromEntries(Object.entries(fallback.meta).map(([key, value]) => [key, typeof saved.meta?.[key] === 'string' ? saved.meta[key] : value]));
  return { customQuestions, answers, meta, step: Number.isInteger(saved.step) ? Math.max(0, Math.min(saved.step, 9 + customQuestions.length - 1)) : 0, finished: Boolean(saved.finished) };
}

export function validateQuestion(draft, existing, editingId = null) {
  if (!draft.area.trim()) return 'Informe a área ou o processo da gráfica.';
  if (!draft.text.trim()) return 'Escreva a pergunta que deseja cadastrar.';
  if (draft.type === 'binary' && (!draft.yes.trim() || !draft.no.trim())) return 'Descreva os caminhos Sim e Não ou mantenha as descrições sugeridas.';
  const normalize = text => text.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
  if (existing.some(q => q.id !== editingId && normalize(q.text) === normalize(draft.text))) return 'Essa pergunta já está no roteiro.';
  return '';
}

export function removeUnansweredQuestion(session, id, orderedQuestions) {
  if (session.answers[id]) throw new Error('Uma pergunta respondida não pode ser excluída nesta entrevista.');
  const index = orderedQuestions.findIndex(q => q.id === id);
  return { ...session, customQuestions: session.customQuestions.filter(q => q.id !== id), step: index < session.step ? Math.max(0, session.step - 1) : Math.min(session.step, orderedQuestions.length - 2) };
}
