// O balao de erro (17/11/2026): quando uma gravacao falha, quem tocou no
// botao ve na hora o que nao deu certo e por que. Aqui so o TEXTO do balao,
// sem tela nenhuma - quem desenha e o mostrarErro (nucleo/util.js), e quem
// chama e o api()/apiPost(), entao vale pra todas as telas de uma vez.
//
// So as gravacoes estao aqui: uma leitura que falha (carregar uma lista) ja
// tem o aviso da propria tela, e varias rodam sozinhas, sem ninguem ter
// tocado em nada. A ficha do pretendente (admissaoEnviar) fica de fora: a
// pagina dela ja mostra o erro no formulario.
//
// O texto completa "Não foi possível ...".
const O_QUE = {
  presenca: 'salvar sua confirmação',
  eventoSalvar: 'salvar o evento',
  eventoRemover: 'apagar o evento',
  membroSalvar: 'salvar o integrante',
  membroRemover: 'remover o integrante',
  criarEventoDeTexto: 'salvar a convocação',
  criarEventosDeCalendario: 'criar os eventos do calendário',
  relatorio: 'gerar o relatório na planilha',
  insightSalvar: 'salvar a rodada de Insight',
  insightRodadaAjustar: 'corrigir a rodada de Insight',
  insightRodadaRemover: 'apagar a rodada de Insight',
  insightMembroRemover: 'tirar o integrante do Insight',
  insightMembroReincluir: 'voltar o integrante pro Insight',
  responsavelSalvar: 'salvar o responsável',
  textoChamadaSalvar: 'salvar o texto da chamada',
  doacoesSalvar: 'salvar as doações',
  caixinhaSalvar: 'salvar o mês da caixinha',
  caixinhaRemover: 'apagar o mês da caixinha',
  caixinhaLancamentoSalvar: 'salvar o lançamento',
  caixinhaLancamentoRemover: 'apagar o lançamento',
  membrosEntradaSalvar: 'salvar as datas de entrada',
  estoqueDoacoesMovimentar: p => (p && p.tipo === 'saida' ? 'registrar a saída do estoque' : 'registrar a entrada no estoque'),
  estoqueDoacoesAnular: 'anular o lançamento do estoque',
  membroMovimentar: 'registrar a movimentação do integrante',
  membroConfirmarGrau: 'confirmar o grau',
  estoqueAdmMovimentar: p => (p && p.tipo === 'saida' ? 'registrar a saída' : 'registrar a entrada'),
  estoqueAdmAnular: 'anular o lançamento',
  estoqueAdmTipo: 'mudar o tipo do material',
  estoqueAdmExcluir: 'excluir o lançamento anulado',
  acaoSocialIdeiaSalvar: 'salvar a ideia',
  acaoSocialIdeiaRemover: 'apagar a ideia',
  acaoSocialAgendaSalvar: 'salvar a ação na agenda',
  acaoSocialAgendaRemover: 'tirar a ação da agenda',
  acaoSocialTextoSalvar: 'salvar o texto',
  acaoSocialTextoRemover: 'apagar o texto',
  acoesSociaisImportar: 'carregar o rascunho',
  fichaMembroSalvar: 'salvar a carteirinha',
  funcaoEventoSalvar: 'salvar o evento',
  funcaoEventoStatus: 'mudar a situação do evento',
  funcaoEventoRemover: 'apagar o evento',
  funcaoPresencasSalvar: 'salvar as presenças',
  funcaoConfigSalvar: 'salvar o ajuste',
  pretendenteSituacao: 'mudar a situação da ficha',
  pretendenteAprovar: 'aprovar o pretendente',
  pretendenteRemover: 'apagar a ficha',
};

export function ehGravacaoComAviso(action) { return Object.prototype.hasOwnProperty.call(O_QUE, action); }

// As mensagens da planilha vem sem acento (o Code.gs evita acento no
// codigo). Estas palavras so tem um jeito de escrever com acento - "esta"
// fica de fora, porque pode ser "esta" ou "está".
const ACENTOS = {
  nao: 'não', ja: 'já', so: 'só', ate: 'até', apos: 'após', mes: 'mês',
  invalida: 'inválida', invalido: 'inválido', disponivel: 'disponível', permissao: 'permissão',
  divisao: 'divisão', divisoes: 'divisões', movimentacao: 'movimentação', observacao: 'observação',
  lancamento: 'lançamento', funcao: 'função', funcoes: 'funções', horario: 'horário', saida: 'saída',
  saidas: 'saídas', situacao: 'situação', numero: 'número', acao: 'ação', acoes: 'ações',
  padrao: 'padrão', conexao: 'conexão', operacao: 'operação', analise: 'análise', proximo: 'próximo',
  usuario: 'usuário', sanguineo: 'sanguíneo', codigo: 'código',
};

function comAcentos(texto) {
  // "ja esta" e "nao esta" so podem ser o verbo.
  return String(texto).replace(/\b(ja|nao) esta\b/gi, '$1 está').replace(/[A-Za-z]+/g, (p) => {
    const certo = ACENTOS[p.toLowerCase()];
    if (!certo) return p;
    return p[0] === p[0].toUpperCase() ? certo[0].toUpperCase() + certo.slice(1) : certo;
  });
}

// O motivo, do jeito que o integrante entende. Falta de internet e planilha
// demorando nao sao culpa de quem tocou - o texto diz isso.
export function motivoLegivel(mensagem) {
  const m = String(mensagem || '').trim();
  if (!m || /falha de conexao|failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
    return 'Sem conexão com a planilha. Confira a internet e tente de novo.';
  }
  if (/demorou demais/i.test(m)) return 'A planilha demorou para responder. Confira se ficou salvo antes de tentar de novo.';
  if (/ocupada/i.test(m)) return 'A planilha está ocupada agora. Espere uns segundos e tente de novo.';
  if (/entre no modo organizador de novo/i.test(m)) return 'Seu acesso venceu. Saia e entre no Modo organizador de novo.';
  if (/quantidade maior que o saldo/i.test(m)) return 'A quantidade é maior que o saldo do material.';
  const t = comAcentos(m);
  return t[0].toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.');
}

// { titulo, motivo } do balao, ou null quando a acao nao tem balao.
export function explicarFalha(action, params, erro) {
  const oque = O_QUE[action];
  if (!oque) return null;
  return {
    titulo: 'Não foi possível ' + (typeof oque === 'function' ? oque(params) : oque) + '.',
    motivo: motivoLegivel(erro && erro.message),
  };
}
