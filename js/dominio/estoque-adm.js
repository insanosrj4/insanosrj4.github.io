// Regras do estoque administrativo do Regional. A quantidade atual vem do
// livro de entradas e saidas; nunca e editada diretamente.

import { formatDataBR, hojeISO } from '../nucleo/util.js';

export const QUANTIDADE_MAXIMA_ESTOQUE_ADM = 100000;

export function quantidadeEstoqueAdm(texto) {
  const t = String(texto || '').replace(/\D/g, '').slice(0, 6);
  const n = Number(t);
  return Number.isInteger(n) && n > 0 && n <= QUANTIDADE_MAXIMA_ESTOQUE_ADM ? n : 0;
}

export function resumoEstoqueAdm(itens) {
  const lista = itens || [];
  return {
    materiais: lista.length,
    unidades: lista.reduce((s, x) => s + (Number(x.quantidade) || 0), 0),
    zerados: lista.filter(x => !Number(x.quantidade)).length,
  };
}

export function textoResumoEstoqueAdm(r) {
  const partes = [
    `${r.materiais} ${r.materiais === 1 ? 'material' : 'materiais'}`,
    `${r.unidades} ${r.unidades === 1 ? 'unidade' : 'unidades'}`,
  ];
  if (r.zerados) partes.push(`${r.zerados} ${r.zerados === 1 ? 'zerado' : 'zerados'}`);
  return partes.join(' · ');
}

// ---------- o tipo de cada material ----------
// A aba Estoque agrupa os materiais por tipo. O app tenta adivinhar pelo
// nome (palpiteTipoMaterialAdm); o que ele nao entende fica em "Onde
// colocar?" ate o organizador escolher, e a escolha fica gravada na coluna
// Tipo de EstoqueADMItens. A escolha gravada vale mais que o palpite.
//
// Sao 4 tipos fixos, e o organizador pode criar outros ("➕ Novo tipo",
// 17/11/2026): o tipo novo e so o texto gravado na coluna Tipo - nao ha
// cadastro de tipos a parte. Ele existe enquanto algum material o usar.
// As chaves fixas estao escritas tambem no Code.gs (TIPOS_MATERIAL_ADM).
export const TIPOS_MATERIAL_ADM = [
  { chave: 'coletes', nome: 'Coletes', emoji: '🦺' },
  { chave: 'bandeiras', nome: 'Bandeiras', emoji: '🚩' },
  { chave: 'patches', nome: 'Patches', emoji: '🏷️' },
  { chave: 'honrarias', nome: 'Honrarias', emoji: '🎖️' },
];
export const EMOJI_TIPO_NOVO_ADM = '📦';
export const TAMANHO_MAXIMO_TIPO_ADM = 30;

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// "Camisas", " camisas " e "CAMISAS" sao o mesmo tipo.
const chaveTipo = (t) => semAcento(t).trim().replace(/\s+/g, ' ');

function tipoNovo(texto) {
  return { chave: texto, nome: texto, emoji: EMOJI_TIPO_NOVO_ADM, novo: true };
}

// Os fixos, na ordem deles, e depois os criados pelo organizador (os que
// algum material usa), em ordem alfabetica.
export function tiposMaterialAdm(itens) {
  const extras = [];
  (itens || []).forEach(x => {
    const t = String((x && x.tipo) || '').trim();
    if (!t || TIPOS_MATERIAL_ADM.some(f => f.chave === chaveTipo(t))) return;
    if (extras.some(e => chaveTipo(e.chave) === chaveTipo(t))) return;
    extras.push(tipoNovo(t));
  });
  extras.sort((a, b) => a.nome.localeCompare(b.nome));
  return TIPOS_MATERIAL_ADM.concat(extras);
}

// Acha o tipo pela chave (sem ligar pra acento ou maiuscula). Um texto que
// nao bate com nenhum vira um tipo novo - e o caso do "Novo tipo" que
// ainda nao foi salvo em material nenhum.
export function tipoMaterialAdmPorChave(chave, tipos = TIPOS_MATERIAL_ADM) {
  const c = chaveTipo(chave);
  if (!c) return null;
  return tipos.find(t => chaveTipo(t.chave) === c) || tipoNovo(String(chave).trim());
}

// O texto digitado no "Novo tipo", arrumado: sem espaco sobrando e com o
// tamanho maximo. Se for o nome de um tipo que ja existe ("coletes"), fica
// a chave dele - assim nao nasce um "Coletes" repetido.
export function textoTipoNovoAdm(texto, tipos = TIPOS_MATERIAL_ADM) {
  const t = String(texto || '').trim().replace(/\s+/g, ' ').slice(0, TAMANHO_MAXIMO_TIPO_ADM);
  if (!t) return '';
  const existente = tipos.find(x => chaveTipo(x.chave) === chaveTipo(t) || chaveTipo(x.nome) === chaveTipo(t));
  return existente ? existente.chave : t;
}

// A ordem importa: "1º Colete Caveira" e o colete do Caveira, nao um patch
// de caveira - por isso colete vem antes. E "Patch honraria 3 anos" e
// honraria. O que nao bater devolve '' (o app pergunta).
const PALPITES_TIPO_ADM = [
  ['coletes', /colete/],
  ['bandeiras', /bandeira/],
  ['honrarias', /honraria|medalha/],
  ['patches', /patch|grau|virgula|caveira/],
];

// Depois dos fixos, os tipos criados: o nome do material tem o nome do
// tipo, no singular ou no plural ("Camisa oficial M2" entra em "Camisas").
// Assim, criado o tipo uma vez, os materiais parecidos se organizam sozinhos.
export function palpiteTipoMaterialAdm(nome, tipos = TIPOS_MATERIAL_ADM) {
  const n = semAcento(nome);
  const achado = PALPITES_TIPO_ADM.find(([, re]) => re.test(n));
  if (achado) return achado[0];
  const criado = tipos.filter(t => t.novo).find(t => {
    const raiz = chaveTipo(t.nome).replace(/e?s$/, '');
    return raiz.length >= 3 && n.includes(raiz);
  });
  return criado ? criado.chave : '';
}

export function tipoDoMaterialAdm(x, tipos = TIPOS_MATERIAL_ADM) {
  const gravado = String((x && x.tipo) || '').trim();
  if (gravado) return tipoMaterialAdmPorChave(gravado, tipos).chave;
  return palpiteTipoMaterialAdm(x && x.nome, tipos);
}

// Os grupos da aba Estoque, na ordem de tiposMaterialAdm, so os que tem
// material. Dentro de cada um: primeiro quem tem saldo, depois os zerados,
// cada parte em ordem alfabetica. `semTipo` sao os que o app nao entendeu.
// Com soComSaldo (o relatorio rapido), os zerados ficam de fora.
export function gruposEstoqueAdm(itens, soComSaldo = false) {
  const tipos = tiposMaterialAdm(itens);
  const lista = (itens || []).filter(x => !soComSaldo || Number(x.quantidade) > 0);
  const ordenar = (a, b) => (Number(b.quantidade) > 0) - (Number(a.quantidade) > 0)
    || String(a.nome).localeCompare(String(b.nome));
  const grupos = tipos
    .map(tipo => ({ tipo, itens: lista.filter(x => tipoDoMaterialAdm(x, tipos) === tipo.chave).sort(ordenar) }))
    .filter(g => g.itens.length);
  const semTipo = lista.filter(x => !tipoDoMaterialAdm(x, tipos)).sort(ordenar);
  return { grupos, semTipo };
}

// ---------- o relatorio rapido (so o que tem em estoque) ----------
// O da aba Estoque: o saldo de hoje, agrupado por tipo, sem os zerados e
// sem as movimentacoes (essas ficam no relatorio da aba Relatorio).
export function estoqueAtualAdm(itens, hoje = hojeISO()) {
  const { grupos, semTipo } = gruposEstoqueAdm(itens, true);
  const comSaldo = (itens || []).filter(x => Number(x.quantidade) > 0);
  return { hoje, grupos, semTipo, resumo: resumoEstoqueAdm(comSaldo) };
}

export function textoEstoqueAtualAdm(r) {
  const partes = [
    '📦 *ESTOQUE ADM* 📦',
    `*REGIONAL* · ${formatDataBR(r.hoje)}`,
  ];
  const bloco = (titulo, itens) => {
    const total = itens.reduce((s, x) => s + (Number(x.quantidade) || 0), 0);
    partes.push('', `*${titulo}* (${total} un)`);
    itens.forEach(x => partes.push(`• ${x.nome}: ${x.quantidade} un`));
  };
  if (!r.grupos.length && !r.semTipo.length) partes.push('', 'Nenhum material em estoque.');
  r.grupos.forEach(g => bloco(`${g.tipo.emoji} ${g.tipo.nome.toUpperCase()}`, g.itens));
  if (r.semTipo.length) bloco('❓ SEM TIPO', r.semTipo);
  if (r.resumo.materiais) partes.push('', `_${r.resumo.materiais} ${r.resumo.materiais === 1 ? 'material' : 'materiais'} · ${r.resumo.unidades} ${r.resumo.unidades === 1 ? 'unidade' : 'unidades'}_`);
  partes.push('', '💀 I.S.S.I');
  return partes.join('\n');
}

// O painel da aba Movimentar (17/11/2026, no jeito do estoque das Doacoes):
// o saldo de hoje, quanto entrou e saiu desde o comeco e o mes a mes dos 6
// ultimos meses (ate o atual). Anulado nao conta.
export function painelEstoqueAdm(itens, movimentos, hoje = hojeISO()) {
  const validos = (movimentos || []).filter(m => !m.anulado);
  const soma = (lista, t) => lista.filter(m => m.tipo === t).reduce((s, m) => s + (Number(m.quantidade) || 0), 0);
  const comSaldo = (itens || []).filter(x => Number(x.quantidade) > 0);
  const [ano, mes] = hoje.split('-').map(Number);
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ano, mes - 1 - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const doMes = validos.filter(m => String(m.data || '').slice(0, 7) === chave);
    meses.push({ mes: chave, entradas: soma(doMes, 'entrada'), saidas: soma(doMes, 'saida') });
  }
  return {
    saldo: comSaldo.reduce((s, x) => s + Number(x.quantidade), 0),
    materiais: comSaldo.length,
    entrou: soma(validos, 'entrada'),
    saiu: soma(validos, 'saida'),
    meses: meses.some(m => m.entradas || m.saidas) ? meses : [],
  };
}

export function filtrarMovimentosEstoqueAdm(movimentos, tipo) {
  const lista = movimentos || [];
  return tipo && tipo !== 'todos' ? lista.filter(x => x.tipo === tipo) : lista;
}

// ---------- o relatorio (WhatsApp, PDF e imagem) ----------
// Segue o filtro da aba (Tudo / Entradas / Saidas). O lancamento anulado
// fica de fora: ele continua no historico da tela, mas no relatorio so
// atrapalharia a conta. O saldo de cada material vai sempre junto.

export const ROTULO_FILTRO_ESTOQUE_ADM = { todos: 'Entradas e saídas', entrada: 'Só entradas', saida: 'Só saídas' };

export function relatorioEstoqueAdm(itens, movimentos, tipo, hoje = hojeISO()) {
  const filtro = tipo === 'entrada' || tipo === 'saida' ? tipo : 'todos';
  const lista = filtrarMovimentosEstoqueAdm(movimentos, filtro).filter(m => !m.anulado);
  const soma = t => lista.filter(m => m.tipo === t).reduce((s, m) => s + (Number(m.quantidade) || 0), 0);
  return {
    hoje, filtro,
    rotuloFiltro: ROTULO_FILTRO_ESTOQUE_ADM[filtro],
    itens: itens || [],
    resumo: resumoEstoqueAdm(itens),
    movimentos: lista,
    entrou: soma('entrada'),
    saiu: soma('saida'),
  };
}

// A linha de um lancamento, igual no texto e na imagem:
// "Colete · 10 un · para Barra · obs".
export function detalheMovimentoEstoqueAdm(m) {
  return [
    m.material,
    `${m.quantidade} un`,
    m.tipo === 'saida' && m.destinoNome ? `para ${m.destinoNome}` : '',
    m.observacao || '',
  ].filter(Boolean).join(' · ');
}

export function textoRelatorioEstoqueAdm(r) {
  const partes = [
    '📦 *RELATÓRIO DO ESTOQUE ADM* 📦',
    `*REGIONAL* · ${formatDataBR(r.hoje)} · ${r.rotuloFiltro}`,
    '',
    '*📦 SALDO ATUAL*',
  ];
  if (!r.itens.length) partes.push('Nenhum material cadastrado.');
  r.itens.forEach(x => partes.push(`• *${x.nome}*: ${Number(x.quantidade) ? `${x.quantidade} un` : 'zerado'}`));
  if (r.itens.length) partes.push(`_${textoResumoEstoqueAdm(r.resumo)}_`);
  partes.push('', '*📋 MOVIMENTAÇÕES*');
  if (!r.movimentos.length) partes.push('Nenhuma movimentação.');
  r.movimentos.forEach(m => partes.push(`${m.tipo === 'entrada' ? '🟢' : '🔴'} ${formatDataBR(m.data)} · ${detalheMovimentoEstoqueAdm(m)}`));
  partes.push('');
  if (r.filtro !== 'saida') partes.push(`🟢 Entrou: ${r.entrou} un`);
  if (r.filtro !== 'entrada') partes.push(`🔴 Saiu: ${r.saiu} un`);
  partes.push('', '💀 I.S.S.I');
  return partes.join('\n');
}
