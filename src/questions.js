export const questions = [
  { area: 'Atendimento e vendas', text: 'A gráfica precisará de um sistema de mensageria para falar com os clientes?', yes: 'Mensageria para atendimento ao cliente', no: 'Atendimento sem mensageria integrada' },
  { area: 'Orçamentos e pedidos', text: 'A gráfica precisará controlar orçamentos e pedidos pelo sistema?', yes: 'Controle de orçamentos e pedidos', no: 'Orçamentos e pedidos fora do sistema' },
  { area: 'Arquivos e aprovação', text: 'A gráfica precisará receber arquivos e registrar a aprovação da arte?', yes: 'Recebimento de arquivos e aprovação de arte', no: 'Arquivos e aprovações tratados fora do sistema' },
  { area: 'Produção', text: 'A gráfica precisará acompanhar as etapas de produção dos pedidos?', yes: 'Acompanhamento das etapas de produção', no: 'Produção sem acompanhamento pelo sistema' },
  { area: 'Estoque', text: 'A gráfica precisará controlar o estoque de papéis e materiais?', yes: 'Controle de estoque de papéis e materiais', no: 'Estoque sem controle pelo sistema' },
  { area: 'Financeiro', text: 'A gráfica precisará de controle financeiro?', yes: 'Controle financeiro da gráfica', no: 'Controle financeiro fora do sistema' },
  { area: 'Emissão fiscal', text: 'A gráfica precisará emitir notas fiscais pelo sistema?', yes: 'Emissão fiscal pelo sistema', no: 'Emissão fiscal fora do sistema' },
  { area: 'Entregas', text: 'A gráfica precisará controlar as entregas dos pedidos?', yes: 'Controle e acompanhamento de entregas', no: 'Entrega sem rastreio pelo sistema' },
  { area: 'Portal do cliente', text: 'O cliente precisará acompanhar o status do pedido pela internet?', yes: 'Portal para acompanhamento do pedido', no: 'Atendimento sem portal do cliente' },
].map((question, index) => ({ ...question, id: `base-${index + 1}`, type: 'binary' }));
