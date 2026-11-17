// Estoque de materiais do Regional: movimentar, consultar saldo e ver o
// livro de entradas/saidas. O saldo nunca e digitado: entrada soma, saida
// subtrai, e anulamento preserva o historico.

import { api } from '../nucleo/api.js';
import { escoposEmOrdemDeExibicao } from '../nucleo/config.js';
import { state } from '../nucleo/estado.js';
import { render } from '../nucleo/render.js';
import { copiarTexto, dataDoCampoOuAvisar, escapeHtml, formatDataBR, hojeISO, imprimirTexto, ordenarPorHierarquia } from '../nucleo/util.js';
import { TAMANHO_MAXIMO_TIPO_ADM, estoqueAtualAdm, filtrarMovimentosEstoqueAdm, gruposEstoqueAdm, palpiteTipoMaterialAdm, quantidadeEstoqueAdm, relatorioEstoqueAdm, resumoEstoqueAdm, textoEstoqueAtualAdm, textoRelatorioEstoqueAdm, textoResumoEstoqueAdm, textoTipoNovoAdm, tipoDoMaterialAdm, tipoMaterialAdmPorChave, tiposMaterialAdm } from '../dominio/estoque-adm.js';
import { botaoGerarRelatorio } from '../ui/comuns.js';
import { imagensEstoqueAtualAdm, imagensRelatorioEstoqueAdm, mostrarPreviaImagem } from '../ui/imagem.js';

function dados() { return state.estoqueAdmDados || { itens: [], movimentos: [] }; }
// Os 4 fixos e os criados pelo organizador (os que algum material usa).
function tipos() { return tiposMaterialAdm(dados().itens); }
// O "➕ Novo tipo" do cadastro de material novo usa esta chave no lugar
// do id do material, que ainda nao existe.
const NOVO_MATERIAL = 'material-novo';

function novoForm(tipo) {
  const itens = dados().itens || [];
  // Na saida, so os que tem saldo: sao os unicos que a lista mostra.
  const lista = tipo === 'saida' ? itens.filter(x => Number(x.quantidade) > 0) : itens;
  return {
    tipo,
    materialId: tipo === 'entrada' && !itens.length ? 'novo' : (lista[0] && lista[0].id) || '',
    // materialTipo: o tipo escolhido no cadastro de material novo. Vazio =
    // ainda vale o palpite pelo nome (palpiteTipoMaterialAdm).
    materialNome: '', materialTipo: '', quantidade: '', data: formatDataBR(hojeISO()),
    destinoTipo: 'divisao', destinoId: 'regional', observacao: '',
  };
}

function aviso() {
  const m = state.estoqueAdmMsg;
  if (!m) return '';
  return `<div class="alert ${m.ok ? 'ok' : ''}" style="margin-bottom:14px;"><div class="alert-msg">${escapeHtml(m.texto)}</div></div>`;
}

function estadoCarregamento() {
  if (state.estoqueAdmCarregando) return '<div class="loading">Carregando estoque…</div>';
  if (state.estoqueAdmErro) return `<div class="alert"><div class="alert-msg">${escapeHtml(state.estoqueAdmErro)}.</div></div>`;
  return '';
}

function opcoesMateriais(soDisponiveis, escolhido) {
  const itens = dados().itens.filter(x => !soDisponiveis || Number(x.quantidade) > 0);
  return itens.map(x => `<option value="${escapeHtml(x.id)}" ${x.id === escolhido ? 'selected' : ''}>${escapeHtml(x.nome)}${soDisponiveis ? ` — ${x.quantidade} disponível` : ''}</option>`).join('');
}

function seletorMaterial(f) {
  const entrada = f.tipo === 'entrada';
  const disponiveis = dados().itens.filter(x => Number(x.quantidade) > 0);
  if (!entrada && !disponiveis.length) return '<div class="empty">Não há material disponível para retirar.</div>';
  // O escolhido tem de ser um dos que aparecem na lista. Senao o celular
  // mostra o primeiro da lista, mas o app manda outro (um zerado) e a
  // saida volta com "Quantidade maior que o saldo disponivel".
  if (!entrada && !disponiveis.some(x => x.id === f.materialId)) f.materialId = disponiveis[0].id;
  return `
    <div class="field">
      <label>Material</label>
      <select data-estoque-adm="materialId">
        ${opcoesMateriais(!entrada, f.materialId)}
        ${entrada ? `<option value="novo" ${f.materialId === 'novo' ? 'selected' : ''}>+ Cadastrar novo material</option>` : ''}
      </select>
    </div>
    ${entrada && f.materialId === 'novo' ? `
      <div class="field"><label>Nome do novo material</label><input type="text" maxlength="60" data-estoque-adm="materialNome" value="${escapeHtml(f.materialNome)}" placeholder="Ex.: Colete, cone, rádio"></div>
      <label>Tipo do material</label>
      <div style="margin:5px 0 10px;">${botoesTipo('estoque-adm-novo-tipo', '', tipoDoNovo(f))}</div>
    ` : ''}
  `;
}

// O tipo do material novo: o escolhido, ou o palpite pelo nome.
function tipoDoNovo(f) { return f.materialTipo || palpiteTipoMaterialAdm(f.materialNome, tipos()); }

// Os tipos em botoes, mais o "➕ Novo tipo", que abre uma caixa pra
// escrever o nome. `id` vai junto quando e um material ja cadastrado; no
// cadastro de material novo fica vazio. Um tipo novo escolhido no cadastro
// ainda nao esta em material nenhum: entra na lista pra aparecer marcado.
function botoesTipo(acao, id, ativo) {
  const lista = tipos();
  if (ativo && !lista.some(t => t.chave === ativo)) lista.push(tipoMaterialAdmPorChave(ativo, lista));
  const dono = id || NOVO_MATERIAL;
  const criando = state.estoqueAdmTipoCriar && state.estoqueAdmTipoCriar.id === dono;
  const comId = id ? ` data-id="${escapeHtml(id)}"` : '';
  return `
    <div class="estoque-adm-tipos">
      ${lista.map(t => `<button class="chip-option ${t.chave === ativo ? 'active' : ''}" data-action="${acao}"${comId} data-value="${escapeHtml(t.chave)}">${t.emoji} ${escapeHtml(t.nome)}</button>`).join('')}
      <button class="chip-option estoque-adm-tipo-mais ${criando ? 'active' : ''}" data-action="estoque-adm-tipo-criar-abrir" data-id="${escapeHtml(dono)}">➕ Novo tipo</button>
    </div>
    ${criando ? `
      <div class="estoque-adm-tipo-criar">
        <div class="field" style="margin:0 0 8px;"><label>Nome do novo tipo</label><input type="text" maxlength="${TAMANHO_MAXIMO_TIPO_ADM}" data-estoque-adm-tipo-nome="1" value="${escapeHtml(state.estoqueAdmTipoCriar.nome)}" placeholder="Ex.: Camisas, Bonés, Adesivos"></div>
        <div class="row-gap">
          <button class="btn" style="flex:1;" data-action="estoque-adm-tipo-criar" data-id="${escapeHtml(dono)}" ${state.estoqueAdmSalvando ? 'disabled' : ''}>${id ? 'Criar e colocar aqui' : 'Usar este tipo'}</button>
          <button class="btn secondary" data-action="estoque-adm-tipo-criar-cancelar">Cancelar</button>
        </div>
      </div>` : ''}
  `;
}

function opcoesIntegrantes(escolhido) {
  const grupos = {};
  ordenarPorHierarquia(state.roster).forEach(m => {
    const divisao = m.divisao || 'Sem divisão';
    (grupos[divisao] = grupos[divisao] || []).push(m);
  });
  return Object.keys(grupos).sort().map(divisao => `
    <optgroup label="${escapeHtml(divisao)}">
      ${grupos[divisao].map(m => `<option value="${escapeHtml(m.id)}" ${m.id === escolhido ? 'selected' : ''}>${escapeHtml(m.nome)}${m.grau ? ` (${escapeHtml(m.grau)})` : ''}</option>`).join('')}
    </optgroup>
  `).join('');
}

function destinoSaida(f) {
  const integrantes = ordenarPorHierarquia(state.roster);
  if (f.destinoTipo === 'membro' && !integrantes.some(m => m.id === f.destinoId)) f.destinoId = integrantes[0] ? integrantes[0].id : '';
  const divisoes = escoposEmOrdemDeExibicao().filter(e => e.chave !== 'regional');
  if (f.destinoTipo === 'divisao' && !divisoes.some(e => e.chave === f.destinoId)) f.destinoId = divisoes[0] ? divisoes[0].chave : '';
  return `
    <label>Destino</label>
    <div class="estoque-adm-destinos">
      <button class="chip-option ${f.destinoTipo === 'divisao' ? 'active' : ''}" data-action="estoque-adm-destino" data-value="divisao">Divisão</button>
      <button class="chip-option ${f.destinoTipo === 'membro' ? 'active' : ''}" data-action="estoque-adm-destino" data-value="membro">Integrante</button>
    </div>
    <div class="field">
      <label>${f.destinoTipo === 'divisao' ? 'Qual divisão recebeu?' : 'Qual integrante recebeu?'}</label>
      <select data-estoque-adm="destinoId">
        ${f.destinoTipo === 'divisao'
          ? divisoes.map(e => `<option value="${e.chave}" ${e.chave === f.destinoId ? 'selected' : ''}>${escapeHtml(e.nome)}</option>`).join('')
          : opcoesIntegrantes(f.destinoId)}
      </select>
    </div>
  `;
}

function formularioMovimento() {
  const f = state.estoqueAdmForm;
  if (!f) return '<div class="empty">Escolha Entrada ou Saída.</div>';
  const semSaida = f.tipo === 'saida' && !dados().itens.some(x => Number(x.quantidade) > 0);
  return `
    <div class="card estoque-adm-form ${f.tipo}">
      <div class="painel-titulo">${f.tipo === 'entrada' ? '🟢 Registrar entrada' : '🔴 Registrar saída'}</div>
      ${seletorMaterial(f)}
      ${semSaida ? '' : `
        <div class="row-gap">
          <div class="field" style="flex:1;"><label>Quantidade</label><input type="text" inputmode="numeric" maxlength="6" data-estoque-adm="quantidade" value="${escapeHtml(f.quantidade)}" placeholder="0"></div>
          <div class="field" style="flex:1;"><label>Data</label><input type="text" inputmode="numeric" maxlength="10" class="campo-data" id="estoque-adm-data" data-estoque-adm="data" value="${escapeHtml(f.data)}" placeholder="dd/mm/aaaa"></div>
        </div>
        ${f.tipo === 'saida' ? destinoSaida(f) : ''}
        <div class="field"><label>Observação (opcional)</label><textarea rows="2" maxlength="200" data-estoque-adm="observacao" placeholder="Ex.: recebido em doação, entregue para evento…">${escapeHtml(f.observacao)}</textarea></div>
        <button class="btn block" data-action="estoque-adm-confirmar" ${state.estoqueAdmSalvando ? 'disabled' : ''}>${state.estoqueAdmSalvando ? 'Salvando…' : f.tipo === 'entrada' ? 'Confirmar entrada' : 'Confirmar saída'}</button>
      `}
    </div>
  `;
}

function renderMovimentar() {
  const f = state.estoqueAdmForm;
  return `
    ${aviso()}
    <div class="estoque-adm-escolhas">
      <button class="card estoque-adm-escolha entrada ${f && f.tipo === 'entrada' ? 'ativa' : ''}" data-action="estoque-adm-tipo" data-value="entrada"><b>🟢 Entrada</b><span>Material recebido</span></button>
      <button class="card estoque-adm-escolha saida ${f && f.tipo === 'saida' ? 'ativa' : ''}" data-action="estoque-adm-tipo" data-value="saida"><b>🔴 Saída</b><span>Material entregue</span></button>
    </div>
    ${formularioMovimento()}
  `;
}

// Uma linha da lista: nome e saldo. Tocar abre a troca de tipo embaixo.
function linhaMaterial(x) {
  const zerado = !Number(x.quantidade);
  const aberto = state.estoqueAdmTipoAberto === x.id;
  return `
    <button class="estoque-adm-linha${zerado ? ' zerado' : ''}${aberto ? ' aberta' : ''}" data-action="estoque-adm-item-abrir" data-id="${escapeHtml(x.id)}" aria-expanded="${aberto}">
      <span>${escapeHtml(x.nome)}</span><b>${zerado ? 'zerado' : `${x.quantidade} un`}</b>
    </button>
    ${aberto ? `
      <div class="estoque-adm-trocar">
        <div class="fin-explica" style="margin:0 0 6px;">Mudar o tipo deste material:</div>
        ${botoesTipo('estoque-adm-item-tipo', x.id, tipoDoMaterialAdm(x, tipos()))}
      </div>` : ''}
  `;
}

// Cada tipo e uma aba que abre e fecha (17/11/2026): fechado mostra so o
// nome, quantos materiais e o total; tocar abre a lista. Um aberto por vez,
// pra tela nao virar um rolo comprido.
function grupoMateriais(tipo, itens) {
  const total = itens.reduce((s, x) => s + (Number(x.quantidade) || 0), 0);
  const aberto = state.estoqueAdmGrupoAberto === tipo.chave;
  return `
    <div class="estoque-adm-grupo${aberto ? ' aberto' : ''}">
      <button class="estoque-adm-grupo-titulo" data-action="estoque-adm-grupo" data-value="${escapeHtml(tipo.chave)}" aria-expanded="${aberto}">
        <span>${tipo.emoji} ${escapeHtml(tipo.nome)}</span>
        <span>${itens.length} ${itens.length === 1 ? 'material' : 'materiais'} · ${total} un <i>${aberto ? '▾' : '▸'}</i></span>
      </button>
      ${aberto ? itens.map(linhaMaterial).join('') : ''}
    </div>
  `;
}

// O que o app nao entendeu pelo nome: fica no topo, perguntando onde
// colocar, ate alguem escolher. A escolha vai pra planilha.
function perguntarTipo(semTipo) {
  if (!semTipo.length) return '';
  return `
    <div class="card estoque-adm-perguntar">
      <div class="painel-titulo">❓ Onde colocar?</div>
      <div class="fin-explica">O app não entendeu o tipo ${semTipo.length === 1 ? 'deste material' : 'destes materiais'} pelo nome. Toque no tipo certo, ou em ➕ Novo tipo para criar outro.</div>
      ${semTipo.map(x => `
        <div class="estoque-adm-perguntar-item">
          <div class="estoque-adm-item"><b>${escapeHtml(x.nome)}</b><strong>${Number(x.quantidade) ? `${x.quantidade} un` : 'zerado'}</strong></div>
          ${botoesTipo('estoque-adm-item-tipo', x.id, '')}
        </div>`).join('')}
    </div>
  `;
}

function renderEstoqueAtual() {
  const itens = dados().itens;
  const resumo = resumoEstoqueAdm(itens);
  const { grupos, semTipo } = gruposEstoqueAdm(itens);
  return `
    ${aviso()}
    ${perguntarTipo(semTipo)}
    <div class="card estoque-adm-atual">
      <div class="painel-titulo">📦 Estoque atual</div>
      <div class="fin-explica">O saldo é calculado pelas entradas e saídas registradas. Toque num tipo para abrir a lista, e num material para mudar o tipo dele.</div>
      <div class="doacao-total">${escapeHtml(textoResumoEstoqueAdm(resumo))}</div>
      ${itens.some(x => Number(x.quantidade) > 0) ? botaoGerarRelatorio('estoque-adm-atual', [
        { acao: 'estoque-adm-atual-texto', rotulo: '📋 WhatsApp' },
        { acao: 'estoque-adm-atual-pdf', rotulo: '📄 PDF' },
        { acao: 'estoque-adm-atual-imagem', rotulo: '🖼️ Imagem' },
      ], 'margin-top:10px;') : ''}
      ${itens.length ? grupos.map(g => grupoMateriais(g.tipo, g.itens)).join('') : '<div class="empty">Nenhum material cadastrado ainda.</div>'}
    </div>
  `;
}

function linhaMovimento(m) {
  const entrada = m.tipo === 'entrada';
  const confirmando = state.estoqueAdmAnularId === m.id;
  const destino = !entrada && m.destinoNome ? ` · para ${escapeHtml(m.destinoNome)}` : '';
  return `
    <div class="card estoque-adm-movimento ${entrada ? 'entrada' : 'saida'}${m.anulado ? ' anulado' : ''}">
      <div class="estoque-adm-mov-topo"><b>${entrada ? '🟢 Entrada' : '🔴 Saída'} · ${m.quantidade} un</b><span>${escapeHtml(formatDataBR(m.data))}</span></div>
      <div class="name">${escapeHtml(m.material)}</div>
      <div class="meta">${entrada ? 'Recebido no estoque' : 'Retirado do estoque'}${destino}${m.observacao ? ` · ${escapeHtml(m.observacao)}` : ''}</div>
      ${m.anulado ? '<div class="estoque-adm-anulado">Lançamento anulado</div>' : confirmando ? `
        <div class="alert" style="margin:10px 0 0;"><div class="alert-msg">Anular este lançamento? O saldo será recalculado e o registro continuará no histórico.</div><div class="row-gap" style="margin-top:8px;"><button class="btn danger" data-action="estoque-adm-anular-confirmar" data-id="${escapeHtml(m.id)}">Anular</button><button class="btn secondary" data-action="estoque-adm-anular-cancelar">Cancelar</button></div></div>
      ` : `<button class="btn ghost" style="padding:4px 0; margin-top:6px; font-size:11px;" data-action="estoque-adm-anular-pedir" data-id="${escapeHtml(m.id)}">Corrigir: anular lançamento</button>`}
    </div>
  `;
}

function relatorioAtual() {
  const d = dados();
  return relatorioEstoqueAdm(d.itens, d.movimentos, state.estoqueAdmFiltroTipo);
}

function renderRelatorio() {
  const lista = filtrarMovimentosEstoqueAdm(dados().movimentos, state.estoqueAdmFiltroTipo);
  return `
    ${aviso()}
    <div class="fin-categorias no-print" style="margin-bottom:12px;">
      ${[['todos','Tudo'],['entrada','🟢 Entradas'],['saida','🔴 Saídas']].map(([chave, nome]) => `<button class="pilula ${state.estoqueAdmFiltroTipo === chave ? 'active' : ''}" data-action="estoque-adm-filtro" data-value="${chave}">${nome}</button>`).join('')}
    </div>
    <div class="card no-print">
      <div class="painel-titulo">📊 Relatório do estoque</div>
      <div class="fin-explica">Saldo de cada material e as movimentações de "${escapeHtml(relatorioAtual().rotuloFiltro)}". Lançamento anulado fica de fora.</div>
      ${botaoGerarRelatorio('estoque-adm-relatorio', [
        { acao: 'estoque-adm-relatorio-texto', rotulo: '📋 WhatsApp' },
        { acao: 'estoque-adm-relatorio-pdf', rotulo: '📄 PDF' },
        { acao: 'estoque-adm-relatorio-imagem', rotulo: '🖼️ Imagem' },
      ], 'margin-top:4px;')}
    </div>
    ${lista.length ? lista.map(linhaMovimento).join('') : '<div class="empty">Nenhuma movimentação neste filtro.</div>'}
  `;
}

export function renderAdminEstoqueAdm() {
  const carregando = estadoCarregamento();
  if (carregando) return carregando;
  if (state.adminTab === 'estoque-adm-estoque') return renderEstoqueAtual();
  if (state.adminTab === 'estoque-adm-relatorio') return renderRelatorio();
  return renderMovimentar();
}

export function atualizarCampoEstoqueAdm(el) {
  // O nome do "➕ Novo tipo": so lembra, sem redesenhar.
  if (el.dataset && el.dataset.estoqueAdmTipoNome && state.estoqueAdmTipoCriar) {
    state.estoqueAdmTipoCriar.nome = el.value;
    return true;
  }
  const chave = el.dataset && el.dataset.estoqueAdm;
  const f = state.estoqueAdmForm;
  if (!chave || !f) return false;
  let valor = el.value;
  if (chave === 'quantidade') {
    valor = valor.replace(/\D/g, '').slice(0, 6);
    el.value = valor;
  }
  f[chave] = valor;
  // O palpite do tipo acompanha o nome sem redesenhar (senao o teclado do
  // celular fecharia a cada letra): so acende o botao certo.
  if (chave === 'materialNome' && !f.materialTipo) {
    const palpite = palpiteTipoMaterialAdm(valor, tipos());
    document.querySelectorAll('[data-action="estoque-adm-novo-tipo"]')
      .forEach(b => b.classList.toggle('active', b.dataset.value === palpite));
  }
  return true;
}

function estoqueAtual() { return estoqueAtualAdm(dados().itens); }

// Grava o tipo de um material ja cadastrado: um dos fixos, um criado antes
// ou um novo (o texto do "➕ Novo tipo").
async function salvarTipo(id, tipo) {
  if (state.estoqueAdmSalvando) return;
  state.estoqueAdmSalvando = true; state.estoqueAdmMsg = null; render();
  try {
    const r = await api('estoqueAdmTipo', { id, tipo });
    state.estoqueAdmDados = { itens:r.itens || [], movimentos:r.movimentos || [] };
    state.estoqueAdmTipoAberto = null;
    state.estoqueAdmTipoCriar = null;
  } catch (e) { state.estoqueAdmMsg = { ok:false, texto:e.message }; }
  state.estoqueAdmSalvando = false; render();
}

export const acoes = {
  'estoque-adm-tipo': async (id, target, action, e) => {
    state.estoqueAdmForm = novoForm(target.dataset.value);
    state.estoqueAdmMsg = null;
    return render();
  },
  'estoque-adm-destino': async (id, target, action, e) => {
    state.estoqueAdmForm.destinoTipo = target.dataset.value;
    state.estoqueAdmForm.destinoId = target.dataset.value === 'divisao'
      ? ((escoposEmOrdemDeExibicao().find(e => e.chave !== 'regional') || {}).chave || '')
      : ((ordenarPorHierarquia(state.roster)[0] || {}).id || '');
    return render();
  },
  'estoque-adm-confirmar': async (id, target, action, e) => {
    const f = state.estoqueAdmForm;
    if (!f || state.estoqueAdmSalvando) return;
    const quantidade = quantidadeEstoqueAdm(f.quantidade);
    if (!quantidade) { state.estoqueAdmMsg = { ok:false, texto:'Informe uma quantidade maior que zero.' }; return render(); }
    const data = dataDoCampoOuAvisar('estoque-adm-data', 'A data da movimentação');
    if (data === null) return;
    if (data > hojeISO()) { state.estoqueAdmMsg = { ok:false, texto:'A data não pode ser no futuro.' }; return render(); }
    if (f.tipo === 'entrada' && f.materialId === 'novo' && !String(f.materialNome).trim()) { state.estoqueAdmMsg = { ok:false, texto:'Escreva o nome do novo material.' }; return render(); }
    if (f.tipo === 'entrada' && f.materialId === 'novo' && !tipoDoNovo(f)) { state.estoqueAdmMsg = { ok:false, texto:'Escolha o tipo do novo material.' }; return render(); }
    if (!f.materialId) { state.estoqueAdmMsg = { ok:false, texto:'Escolha o material.' }; return render(); }
    if (f.tipo === 'saida' && !f.destinoId) { state.estoqueAdmMsg = { ok:false, texto:'Escolha quem recebeu o material.' }; return render(); }
    state.estoqueAdmSalvando = true; state.estoqueAdmMsg = null; render();
    try {
      const r = await api('estoqueAdmMovimentar', {
        tipo:f.tipo, materialId:f.materialId === 'novo' ? '' : f.materialId,
        materialNome:f.materialId === 'novo' ? String(f.materialNome).trim() : '',
        materialTipo:f.materialId === 'novo' ? tipoDoNovo(f) : '',
        quantidade, data, destinoTipo:f.tipo === 'saida' ? f.destinoTipo : '',
        destinoId:f.tipo === 'saida' ? f.destinoId : '', observacao:String(f.observacao || '').trim(),
      });
      state.estoqueAdmDados = { itens:r.itens || [], movimentos:r.movimentos || [] };
      state.estoqueAdmForm = null;
      state.estoqueAdmMsg = { ok:true, texto:`${f.tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso.` };
    } catch (e) { state.estoqueAdmMsg = { ok:false, texto:e.message }; }
    state.estoqueAdmSalvando = false; render();
  },
  'estoque-adm-novo-tipo': async (id, target, action, e) => {
    state.estoqueAdmForm.materialTipo = target.dataset.value;
    return render();
  },
  // Tocar num material da lista abre (ou fecha) a troca de tipo dele.
  'estoque-adm-grupo': async (id, target, action, e) => {
    const chave = target.dataset.value;
    state.estoqueAdmGrupoAberto = state.estoqueAdmGrupoAberto === chave ? null : chave;
    state.estoqueAdmTipoAberto = null;
    state.estoqueAdmTipoCriar = null;
    return render();
  },
  'estoque-adm-item-abrir': async (id, target, action, e) => {
    state.estoqueAdmTipoAberto = state.estoqueAdmTipoAberto === id ? null : id;
    state.estoqueAdmTipoCriar = null;
    return render();
  },
  'estoque-adm-item-tipo': async (id, target, action, e) => salvarTipo(id, target.dataset.value),
  // "➕ Novo tipo": abre a caixa do nome (ou fecha, num segundo toque).
  'estoque-adm-tipo-criar-abrir': async (id, target, action, e) => {
    const aberto = state.estoqueAdmTipoCriar && state.estoqueAdmTipoCriar.id === id;
    state.estoqueAdmTipoCriar = aberto ? null : { id, nome: '' };
    state.estoqueAdmMsg = null;
    return render();
  },
  'estoque-adm-tipo-criar-cancelar': async (id, target, action, e) => { state.estoqueAdmTipoCriar = null; return render(); },
  'estoque-adm-tipo-criar': async (id, target, action, e) => {
    const c = state.estoqueAdmTipoCriar;
    if (!c) return;
    const tipo = textoTipoNovoAdm(c.nome, tipos());
    if (!tipo) { state.estoqueAdmMsg = { ok:false, texto:'Escreva o nome do novo tipo.' }; return render(); }
    // No cadastro de material novo, o tipo so vai pra planilha junto com a
    // entrada. Num material ja cadastrado, grava na hora.
    if (id === NOVO_MATERIAL) {
      if (state.estoqueAdmForm) state.estoqueAdmForm.materialTipo = tipo;
      state.estoqueAdmTipoCriar = null;
      return render();
    }
    return salvarTipo(id, tipo);
  },
  // O relatorio rapido da aba Estoque: so o saldo de hoje, sem zerados.
  'estoque-adm-atual-texto': async (id, target, action, e) => copiarTexto(textoEstoqueAtualAdm(estoqueAtual())),
  'estoque-adm-atual-pdf': async (id, target, action, e) => imprimirTexto(textoEstoqueAtualAdm(estoqueAtual())),
  'estoque-adm-atual-imagem': async (id, target, action, e) => {
    const r = estoqueAtual();
    return mostrarPreviaImagem(() => imagensEstoqueAtualAdm(r), 'estoque-adm-atual.png');
  },
  'estoque-adm-filtro': async (id, target, action, e) => { state.estoqueAdmFiltroTipo = target.dataset.value; return render(); },
  // O relatorio pro grupo: texto, PDF (o mesmo texto, impresso) e imagem.
  'estoque-adm-relatorio-texto': async (id, target, action, e) => copiarTexto(textoRelatorioEstoqueAdm(relatorioAtual())),
  'estoque-adm-relatorio-pdf': async (id, target, action, e) => imprimirTexto(textoRelatorioEstoqueAdm(relatorioAtual())),
  'estoque-adm-relatorio-imagem': async (id, target, action, e) => {
    const r = relatorioAtual();
    return mostrarPreviaImagem(() => imagensRelatorioEstoqueAdm(r), 'estoque-adm-relatorio.png');
  },
  'estoque-adm-anular-pedir': async (id, target, action, e) => { state.estoqueAdmAnularId = id; return render(); },
  'estoque-adm-anular-cancelar': async (id, target, action, e) => { state.estoqueAdmAnularId = null; return render(); },
  'estoque-adm-anular-confirmar': async (id, target, action, e) => {
    if (state.estoqueAdmSalvando) return;
    state.estoqueAdmSalvando = true; state.estoqueAdmMsg = null; render();
    try {
      const r = await api('estoqueAdmAnular', { id });
      state.estoqueAdmDados = { itens:r.itens || [], movimentos:r.movimentos || [] };
      state.estoqueAdmMsg = { ok:true, texto:'Lançamento anulado e estoque recalculado.' };
      state.estoqueAdmAnularId = null;
    } catch (e) { state.estoqueAdmMsg = { ok:false, texto:e.message }; }
    state.estoqueAdmSalvando = false; render();
  },
};
