// As regras de status de presenca (inclusive Aguardando virar Infracional).

import { STATUS, escopoPorChave } from '../nucleo/config.js';
import { state } from '../nucleo/estado.js';
import { ordenarPorHierarquia } from '../nucleo/util.js';

// Nao responder a convocacao e falta igual a uma falta sem justificativa
// (decisao do clube) - so faz sentido continuar "Aguardando" enquanto o
// evento ainda esta aberto (a pessoa ainda pode responder). O Code.gs ja
// converte isso na planilha ao encerrar (converterAguardandoParaInfracionalAoEncerrar),
// mas essa funcao e chamada aqui tambem, na leitura, como rede de seguranca
// pra eventos que ja estavam encerrados antes dessa regra existir - sem
// isso eles ficariam eternamente mostrando "Aguardando" ate alguem rodar a
// migracao manual na planilha (migrarAguardandoDeEventosJaEncerrados).
export function statusEfetivo(ev, statusBruto) {
  return (ev.status === 'encerrado' && statusBruto === 'aguardando') ? 'infracional' : statusBruto;
}

// Evento fora de toda conta de presenca (rank, % da divisao, faltas,
// Insights, relatorios): hoje so a reuniao do Social Regional com os sociais
// das divisoes (Painel Social, 13/11/2026). O resultado do proprio evento
// continua aparecendo nele. A marca fica no JSON da chamada; o Code.gs faz a
// mesma conta (eventoForaDoRank).
export function contaNoRank(ev) {
  return !(ev && ev.chamada && ev.chamada.foraDoRank === true);
}

export function computeCounts(ev) {
  const statusData = state.reportData[ev.id] || {};
  const counts = Object.fromEntries(Object.keys(STATUS).map(k => [k, 0]));
  ev.memberIds.forEach(mid => {
    const s = statusEfetivo(ev, (statusData[mid] && statusData[mid].status) || 'aguardando');
    if (counts[s] !== undefined) counts[s]++; else counts.aguardando++;
  });
  return counts;
}

// A ordem dos nomes no relatorio de presenca de um evento (26/11/2026, pedido
// do Social Regional): os do Regional primeiro, e depois os irmaos das
// divisoes, todos juntos, na ordem hierarquica (grau, cargo nos graus VI e
// V, nome - ordenarPorHierarquia). Ate ali saiam na ordem da convocacao.
export function ordemDoRelatorio(membros) {
  const regional = escopoPorChave('regional').nome;
  const doRegional = membros.filter(m => m.divisao === regional);
  const dasDivisoes = membros.filter(m => m.divisao !== regional);
  return ordenarPorHierarquia(doRegional).concat(ordenarPorHierarquia(dasDivisoes));
}

// Como o nome sai no relatorio: com o grau ao lado, "Bull (VI)".
export const nomeNoRelatorio = (m) => (m.grau ? `${m.nome} (${m.grau})` : m.nome);

export function getReportGroups(ev) {
  const statusData = state.reportData[ev.id] || {};
  const groups = Object.fromEntries(Object.keys(STATUS).map(k => [k, []]));
  const convocados = ev.memberIds.map(mid => state.roster.find(r => r.id === mid)).filter(Boolean);
  ordemDoRelatorio(convocados).forEach(m => {
    const s = statusEfetivo(ev, (statusData[m.id] && statusData[m.id].status) || 'aguardando');
    (groups[s] || groups.aguardando).push(nomeNoRelatorio(m));
  });
  return groups;
}
