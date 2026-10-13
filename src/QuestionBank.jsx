import React, { useRef, useState } from 'react';
import { ChevronDown, ListPlus, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { validateQuestion } from './session';

const blank = () => ({ area: '', text: '', type: 'binary', yes: 'Resposta Sim registrada', no: 'Resposta Não registrada' });

export default function QuestionBank({ questions, customQuestions, answers, onSave, onRemove }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef(null);
  function edit(question) {
    setDraft(question ? { ...question } : blank());
    setEditingId(question?.id || null);
    setError(''); setNotice(''); setOpen(true);
    setTimeout(() => formRef.current?.querySelector('input')?.focus(), 0);
  }
  function submit(event) {
    event.preventDefault();
    const message = validateQuestion(draft, questions, editingId);
    if (message) { setError(message); return; }
    if (editingId && answers[editingId]) { setError('Esta pergunta já foi respondida. Reinicie a entrevista para editá-la.'); return; }
    const question = { ...draft, id: editingId || `custom-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, area: draft.area.trim(), text: draft.text.trim(), yes: draft.yes.trim(), no: draft.no.trim() };
    onSave(question);
    setDraft(null); setEditingId(null); setError('');
    setNotice('Pergunta salva e incluída no roteiro da entrevista.');
  }
  return <section className="question-bank card" aria-labelledby="bank-title">
    <div className="bank-heading">
      <div className="bank-heading-copy"><span className="bank-icon"><ListPlus size={21}/></span><div><h2 id="bank-title">Perguntas do roteiro</h2><p>{questions.length} perguntas · {customQuestions.length} cadastradas por você</p></div></div>
      <div className="bank-actions"><button className="secondary-button bank-toggle" aria-expanded={open} aria-controls="question-bank-content" onClick={() => setOpen(!open)}>Gerenciar <ChevronDown size={16}/></button><button className="primary-button" onClick={() => edit(null)}><Plus size={17}/> Nova pergunta</button></div>
    </div>
    <p className="bank-notice" role="status">{notice}</p>
    {open && <div id="question-bank-content" className="bank-content">
      <p className="bank-description">Acrescente perguntas sobre os processos da gráfica durante a visita. Elas entram no roteiro e nos PDFs.</p>
      {draft && <form ref={formRef} className="question-form" onSubmit={submit}>
        <div className="form-heading"><h3>{editingId ? 'Editar pergunta' : 'Cadastrar pergunta'}</h3><button type="button" className="icon-button" aria-label="Fechar formulário" onClick={() => { setDraft(null); setError(''); }}><X size={18}/></button></div>
        <label className="bank-question-label">Área ou processo<input required maxLength={80} value={draft.area} onChange={e => setDraft({ ...draft, area: e.target.value })} placeholder="Ex.: Acabamento e revisão"/></label>
        <p className="bank-description">Resposta Sim/Não, com observação opcional durante a entrevista.</p>
        <label className="bank-question-label">Pergunta<textarea required maxLength={300} rows={3} value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} placeholder="O que você precisa entender sobre a gráfica?"/></label>
        {draft.type === 'binary' && <div className="bank-fields"><label>Descrição do caminho Sim<input required maxLength={120} value={draft.yes} onChange={e => setDraft({ ...draft, yes: e.target.value })}/></label><label>Descrição do caminho Não<input required maxLength={120} value={draft.no} onChange={e => setDraft({ ...draft, no: e.target.value })}/></label></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => { setDraft(null); setError(''); }}>Cancelar</button><button type="submit" className="primary-button"><Save size={16}/> Salvar pergunta</button></div>
      </form>}
      <div className="custom-question-list">{customQuestions.length === 0 ? <p className="bank-empty">As 9 perguntas iniciais já estão disponíveis. Use “Nova pergunta” para ampliar seu roteiro.</p> : customQuestions.map(q => <article key={q.id} className="custom-question-item"><div><span className="custom-question-area">{q.area} · Sim / Não</span><h3>{q.text}</h3>{answers[q.id] && <p className="question-locked">Respondida nesta entrevista. Reinicie para editar ou excluir.</p>}</div><div className="custom-question-actions"><button className="icon-button" disabled={Boolean(answers[q.id])} aria-label={`Editar pergunta: ${q.text}`} onClick={() => edit(q)}><Pencil size={17}/></button><button className="icon-button danger-button" disabled={Boolean(answers[q.id])} aria-label={`Excluir pergunta: ${q.text}`} onClick={() => { if (window.confirm('Excluir esta pergunta do cadastro e do roteiro?')) { onRemove(q.id); setNotice('Pergunta excluída.'); if (editingId === q.id) setDraft(null); } }}><Trash2 size={17}/></button></div></article>)}</div>
      <p className="storage-hint">Cadastro e entrevista salvos apenas neste navegador. Para usar em outro dispositivo, o cadastro precisa ser feito nele também.</p>
    </div>}
  </section>;
}
