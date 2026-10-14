import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowLeft, ArrowRight, Check, Download, LoaderCircle, RotateCcw } from 'lucide-react';
import './styles.css';
import { questions as baseQuestions } from './questions';
import QuestionBank from './QuestionBank';
import { emptySession, loadSession, removeUnansweredQuestion, STORAGE_KEY } from './session';



function Shape({ type, children, className = '' }) {
  return <div className={`shape ${type} ${className}`}>{children}</div>;
}

function PdfButton({ mode, exporting, onExport, className }) {
  const busy = exporting === mode;
  return <button className={className} disabled={Boolean(exporting)} aria-busy={busy} onClick={() => onExport(mode)}>
    {busy ? <LoaderCircle size={16} className="pdf-spinner"/> : <Download size={16}/>}
    {busy ? 'Gerando PDF…' : mode === 'flow' ? 'PDF do fluxograma' : 'PDF da entrevista'}
  </button>;
}

function App() {
  const [session, setSession] = useState(() => {
    try { return loadSession(window.localStorage); } catch { return emptySession(); }
  });
  const { meta, answers, step, customQuestions } = session;
  const questions = useMemo(() => [...baseQuestions, ...customQuestions], [customQuestions]);
  const setMeta = value => setSession(prev => ({ ...prev, meta: value }));
  const setStep = value => setSession(prev => ({ ...prev, step: Math.min(value, questions.length - 1), finished: value >= questions.length }));
  const [storageError, setStorageError] = useState('');
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');
  const exportLock = useRef(false);
  const current = questions[step];
  const completed = questions.filter(q => answers[q.id]).length;
  const allDone = session.finished && completed === questions.length;
  const answerList = useMemo(() => questions.map((q, i) => answers[q.id] ? ({ ...q, index: i, ...answers[q.id] }) : null).filter(Boolean), [answers, questions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, version: 1 }));
      setStorageError('');
    } catch {
      setStorageError('Este navegador não permitiu salvar os dados. A entrevista continua disponível nesta tela; exporte os PDFs antes de fechá-la.');
    }
  }, [session]);

  function choose(value) {
    setSession(prev => ({ ...prev, answers: { ...prev.answers, [current.id]: { value, label: value === 'sim' ? current.yes : current.no, note: prev.answers[current.id]?.note || '' } } }));
  }
  function updateNote(value) {
    setSession(prev => ({ ...prev, answers: { ...prev.answers, [current.id]: { ...prev.answers[current.id], note: value } } }));
  }
  function reset() {
    if (completed && !window.confirm('Reiniciar a entrevista e limpar as respostas? As perguntas cadastradas serão mantidas.')) return;
    setSession(prev => ({ ...prev, answers: {}, step: 0, finished: false }));
  }
  function saveQuestion(question) {
    setSession(prev => {
      const editing = prev.customQuestions.some(q => q.id === question.id);
      const customQuestions = editing ? prev.customQuestions.map(q => q.id === question.id ? question : q) : [...prev.customQuestions, question];
      return { ...prev, customQuestions, step: !editing && prev.finished ? baseQuestions.length + prev.customQuestions.length : prev.step, finished: editing ? prev.finished : false };
    });
  }
  async function exportPdf(mode) {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(mode);
    setExportError('');
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const { downloadPdf } = await import('./pdf');
      await downloadPdf(mode, meta, questions, answers);
    } catch (error) {
      console.error('PDF export failed', error);
      setExportError('N\u00e3o foi poss\u00edvel gerar o PDF. Tente novamente.');
    } finally {
      exportLock.current = false;
      setExporting('');
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Início"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}seatec-logo.png`} alt="SEATEC" /></span><span>gráfica<span className="brand-light">fluxo</span></span></a>
      <div className="topbar-right"><span className="session-label"><i /> {allDone ? 'Entrevista concluída' : 'Entrevista em andamento'}</span><button className="text-button" onClick={reset}><RotateCcw size={15}/> Reiniciar</button></div>
    </header>

    <main id="top" className="page-wrap">
      {exportError && <p className="pdf-error" role="alert">{exportError}</p>}
      {storageError && <p className="pdf-error" role="alert">{storageError}</p>}
      <span className="sr-only" role="status">{exporting ? "Gerando PDF..." : ""}</span>
      <section className="intro-row">
        <div><div className="eyebrow">LEVANTAMENTO DE REQUISITOS <span>•</span> GRÁFICA</div><h1>Entrevista de descoberta</h1><p className="subtitle">Mapeie as necessidades da gráfica, uma conversa de cada vez.</p></div>
        <div className="progress-card"><div className="progress-copy"><span>Progresso</span><strong>{allDone ? 'Concluído' : `${completed} de ${questions.length}`}</strong></div><div className="progress-track"><span style={{ width: `${(completed / questions.length) * 100}%` }}/></div></div>
      </section>

      <section className="metadata card">
        <div className="section-heading"><div><span className="step-index">01</span><div><h2>Dados da entrevista</h2><p>Identifique os participantes e a gráfica.</p></div></div><span className="optional-tag">Preencha antes de exportar</span></div>
        <div className="fields-grid">
          <label>Nome da gráfica<input value={meta.company} onChange={e => setMeta({ ...meta, company: e.target.value })} placeholder="Ex.: Gráfica Central" /></label>
          <label>Administrador entrevistado<input value={meta.admin} onChange={e => setMeta({ ...meta, admin: e.target.value })} placeholder="Nome do administrador" /></label>
          <label>Diretor entrevistador<input value={meta.director} onChange={e => setMeta({ ...meta, director: e.target.value })} placeholder="Nome do diretor" /></label>
          <label>Data<input type="date" value={meta.date} onChange={e => setMeta({ ...meta, date: e.target.value })} /></label>
        </div>
      </section>

      <QuestionBank questions={questions} customQuestions={customQuestions} answers={answers} onSave={saveQuestion} onRemove={id => setSession(prev => removeUnansweredQuestion(prev, id, questions))}/>

      {!allDone ? <section className="interview-section">
        <div className="interview-title"><div><span className="step-index">02</span><div><h2>Roteiro da entrevista</h2><p>Selecione a resposta dada pelo administrador.</p></div></div><span className="question-count">PERGUNTA {String(step + 1).padStart(2, '0')} <b>/ {String(questions.length).padStart(2, '0')}</b></span></div>
        <div className="flow-card card">
          <div className="flow-topline"><span className="area-pill">{current.area}</span><span className="flow-hint">Escolha uma resposta para avançar</span></div>
          <div className="flow-canvas">
            <Shape type="question-shape"><span className="q-small">PERGUNTA-CHAVE</span><span>{current.text}</span></Shape>
            <div className="branch-lines"><div className="branch"><span className="branch-label yes-label">SIM</span><ArrowDown size={19}/></div><div className="branch"><span className="branch-label no-label">NÃO</span><ArrowDown size={19}/></div></div>
            <div className="answer-grid">
              <button aria-pressed={answers[current.id]?.value === 'sim'} className={`answer-card yes-card ${answers[current.id]?.value === 'sim' ? 'selected' : ''}`} onClick={() => choose('sim')}><Shape type="yes-shape"><Check size={16}/></Shape><span className="answer-word">Sim</span><span className="answer-desc">{current.yes}</span><span className="select-mark">{answers[current.id]?.value === 'sim' ? 'Selecionado' : 'Selecionar resposta'} <ArrowRight size={14}/></span></button>
              <button aria-pressed={answers[current.id]?.value === 'nao'} className={`answer-card no-card ${answers[current.id]?.value === 'nao' ? 'selected' : ''}`} onClick={() => choose('nao')}><Shape type="no-shape"><span>×</span></Shape><span className="answer-word">Não</span><span className="answer-desc">{current.no}</span><span className="select-mark">{answers[current.id]?.value === 'nao' ? 'Selecionado' : 'Selecionar resposta'} <ArrowRight size={14}/></span></button>
            </div>
            {answers[current.id] ? <div className="note-box"><label htmlFor="response-note">Observação <span>opcional</span></label><textarea id="response-note" value={answers[current.id]?.note || ''} onChange={e => updateNote(e.target.value)} placeholder="Acrescente um detalhe informado durante a entrevista..." rows="2"/><div className="step-actions"><button className="back-button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><ArrowLeft size={15}/> Voltar</button><button className="primary-button" onClick={() => setStep(step + 1)}>{step === questions.length - 1 ? 'Finalizar entrevista' : 'Próxima pergunta'} <ArrowRight size={16}/></button></div></div> : <div className="next-placeholder">{step > 0 && <button className="back-button" onClick={() => setStep(step - 1)}><ArrowLeft size={15}/> Voltar</button>}<span>Selecione Sim ou Não para registrar a resposta</span></div>}
          </div>
        </div>
      </section> : <section className="done-card card"><div className="done-icon"><Check size={24}/></div><div><span className="eyebrow">ROTEIRO CONCLUÍDO</span><h2>Entrevista pronta para exportar</h2><p>Escolha o documento que deseja gerar.</p></div><div className="done-actions"><PdfButton mode="interview" exporting={exporting} onExport={exportPdf} className="primary-button"/><PdfButton mode="flow" exporting={exporting} onExport={exportPdf} className="secondary-button"/></div></section>}

      {answerList.length > 0 && <section className="summary-section"><div className="summary-heading"><div><span className="step-index">03</span><div><h2>Respostas registradas</h2><p>As respostas serão organizadas nesta ordem no PDF.</p></div></div><div className="summary-exports"><PdfButton mode="interview" exporting={exporting} onExport={exportPdf} className="export-button"/><PdfButton mode="flow" exporting={exporting} onExport={exportPdf} className="export-button"/></div></div><div className="summary-list">{answerList.map(item => <article className="summary-item" key={item.id}><div className="summary-number">{String(item.index + 1).padStart(2, '0')}</div><div className="summary-body"><span className="summary-area">{item.area}</span><h3>{item.text}</h3>{item.note && <p>{item.note}</p>}</div><button className="review-button" onClick={() => setStep(item.index)} aria-label={`Revisar pergunta ${item.index + 1}`}><ArrowLeft size={15}/> Revisar</button><span className={`summary-answer ${item.value}`}>{item.value === 'sim' ? 'Sim' : 'Não'}</span></article>)}</div></section>}
    </main>

    <footer><span>gráficafluxo <i>•</i> Entrevista de requisitos</span><span>Versão inicial</span></footer>


  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
