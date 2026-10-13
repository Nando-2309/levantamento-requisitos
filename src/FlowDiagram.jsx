import React from 'react';

function wrap(text, limit = 29) {
  return text.split(/\s+/).reduce((lines, word) => {
    if (!lines.length || lines[lines.length - 1].length + word.length + 1 > limit) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
    return lines;
  }, []);
}

function Label({ text, x, y, limit, className = '' }) {
  const lines = wrap(text, limit);
  return <text x={x} y={y - (lines.length - 1) * 8} textAnchor="middle" className={className}>
    {lines.map((line, i) => <tspan key={i} x={x} dy={i ? 16 : 0}>{line}</tspan>)}
  </text>;
}

export default function FlowDiagram({ questions, answers }) {
  const positions = questions.map((_, i) => {
    const row = Math.floor(i / 3);
    const col = row % 2 ? 2 - i % 3 : i % 3;
    return { x: 250 + col * 500, y: 130 + row * 310 };
  });
  return <svg className="export-diagram" viewBox="0 0 1500 1040" role="img" aria-labelledby="diagram-title diagram-desc">
    <title id="diagram-title">Fluxograma de levantamento de requisitos da gráfica</title>
    <desc id="diagram-desc">Nove decisões em sequência, com os caminhos Sim e Não reunidos antes da próxima pergunta. Respostas registradas destacadas com borda e indicação textual.</desc>
    <defs>
      {['neutral', 'yes', 'no'].map((kind, i) => <marker key={kind} id={`arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={['#536171', '#238653', '#cc4c4c'][i]}/></marker>)}
    </defs>
    <rect x="170" y="10" width="160" height="36" rx="18" className="diagram-terminal"/>
    <Label text="Início da entrevista" x={250} y={33}/>
    <path d="M250 46 V70" className="diagram-link" markerEnd="url(#arrow-neutral)"/>
    {positions.slice(0, -1).map((p, i) => {
      const next = positions[i + 1];
      const sameRow = p.y === next.y;
      const lane = p.y + 150;
      const side = Math.floor(i / 3) % 2 ? next.x + 235 : next.x - 235;
      const path = sameRow
        ? `M${p.x} ${p.y + 150} H${side} V${next.y} H${next.x + (side < next.x ? -122 : 122)}`
        : `M${p.x} ${lane} V${next.y - 60}`;
      return <path key={i} d={path} className="diagram-link" markerEnd="url(#arrow-neutral)"/>;
    })}
    {questions.map((q, i) => {
      const { x, y } = positions[i];
      const answer = answers[i];
      return <g key={i}>
        <text x={x} y={y - 72} textAnchor="middle" className="diagram-area">{String(i + 1).padStart(2, '0')} · {q.area}</text>
        <path d={`M${x} ${y - 60} L${x + 122} ${y} L${x} ${y + 60} L${x - 122} ${y} Z`} className="diagram-decision"/>
        <Label text={q.text} x={x} y={y} limit={26} className="diagram-question"/>
        {['sim', 'nao'].map((value, b) => {
          const bx = x + (b ? 119 : -119);
          const selected = answer?.value === value;
          return <g key={value}>
            <path d={`M${x + (b ? 68 : -68)} ${y + 27} H${bx} V${y + 78}`} className={`diagram-link ${value}`} markerEnd={`url(#arrow-${b ? 'no' : 'yes'})`}/>
            <text x={bx + (b ? 20 : -20)} y={y + 57} textAnchor="middle" className={`diagram-branch ${value}`}>{b ? 'NÃO' : 'SIM'}</text>
            <rect x={bx - 105} y={y + 80} width="210" height="58" rx="7" className={`diagram-process ${value} ${selected ? 'is-chosen' : ''}`}/>
            <Label text={b ? q.no : q.yes} x={bx} y={y + 105} limit={29}/>
            {selected && <text x={bx} y={y + 132} textAnchor="middle" className="diagram-selected">✓ Resposta registrada</text>}
            <path d={`M${bx} ${y + 138} V${y + 150} H${x}`} className="diagram-link"/>
          </g>;
        })}
        <circle cx={x} cy={y + 150} r="3" fill="#536171"/>
      </g>;
    })}
    <path d="M1250 900 V950" className="diagram-link" markerEnd="url(#arrow-neutral)"/>
    <rect x="1170" y="952" width="160" height="36" rx="18" className="diagram-terminal"/>
    <Label text="Fim da entrevista" x={1250} y={975}/>
    <text x="50" y="1020" className="diagram-area">Leitura em sequência: 01 → 03, 06 ← 04, 07 → 09. A borda destacada indica a resposta registrada.</text>
  </svg>;
}
