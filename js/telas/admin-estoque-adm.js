// Estoque de materiais do Regional: movimentar, consultar saldo e ver o
// livro de entradas/saidas. O saldo nunca e digitado: entrada soma, saida
// subtrai, e anulamento preserva o historico.

import { api } from '../nucleo/api.js';
import { escoposEmOrdemDeExibicao } from '../nucleo/config.js';
import { state } from '../nucleo/estado.js';
import { render } from '../nucleo/render.js';
import { copiarTexto, dataDoCampoOuAvisar, escapeHtml, formatDataBR, hojeISO, imprimirTexto, ordenarPorHierarquia } from '../nucleo/util.js';
import { TAMANHO_MAXIMO_TIPO_ADM, estoqueAtualAdm, painelEstoqueAdm, gruposEstoqueAdm, palpiteTipoMaterialAdm, quantidadeEstoqueAdm, relatorioEstoqueAdm, resumoEstoqueAdm, textoEstoqueAtualAdm, textoRelatorioEstoqueAdm, textoResumoEstoqueAdm, textoTipoNovoAdm, tipoDoMaterialAdm, tipoMaterialAdmPorChave, tiposMaterialAdm } from '../dominio/estoque-adm.js';
import { nomeCurtoDoMes, nomeDoMes } from '../dominio/caixinha.js';
import { botaoGerarRelatorio } from '../ui/comuns.js';
import { renderPizza } from '../ui/graficos.js';
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

// O painel em cima (17/11/2026, no jeito do estoque das Doacoes): o saldo,
// o que entrou e saiu, a pizza e os botoes de lancar. O formulario abre
// embaixo, e o mes a mes fica no fim.
function painelMovimentar(p) {
  const f = state.estoqueAdmForm;
  const un = (n) => `${n} un`;
  return `
    <div class="card">
      <div class="painel-titulo">📦 Estoque ADM</div>
      <div class="fin-subtitulo">Materiais do Regional RJ4</div>
      <div class="fin-saldo" data-anima="estoque-adm-saldo:${p.saldo}">
        <span>Saldo atual</span>
        <b>${un(p.saldo)}</b>
      </div>
      <div class="fin-nota" style="text-align:center; margin-top:-4px;">${p.materiais} ${p.materiais === 1 ? 'material com saldo' : 'materiais com saldo'}</div>
      <div class="fin-placar">
        <div class="fin-placar-item entrada"><span>🟢 Entrou</span><b>${un(p.entrou)}</b></div>
        <div class="fin-placar-item saida"><span>🔴 Saiu</span><b>${un(p.saiu)}</b></div>
      </div>
      ${renderPizza([
        { label: 'Entradas', value: p.entrou, cor: 'var(--status-confirmado)', texto: un(p.entrou) },
        { label: 'Saídas', value: p.saiu, cor: 'var(--status-infracional)', texto: un(p.saiu) },
      ], 130, 'Nada lançado')}
      <div class="row-gap no-print" style="margin-top:14px;">
        <button class="btn ${f && f.tipo === 'saida' ? '' : 'secondary'}" style="flex:1;" data-action="estoque-adm-tipo" data-value="saida" ${p.saldo > 0 ? '' : 'disabled'}>🔴 Lançar saída</button>
        <button class="btn ${f && f.tipo === 'entrada' ? '' : 'secondary'}" style="flex:1;" data-action="estoque-adm-tipo" data-value="entrada">🟢 Lançar entrada</button>
      </div>
    </div>
  `;
}

// Entrou x saiu nos 6 ultimos meses - as mesmas barras do estoque das Doacoes.
function barrasPorMes(meses) {
  const maior = Math.max(...meses.map(m => Math.max(m.entradas, m.saidas)), 1);
  return `
    <div class="card">
      <div class="painel-titulo">📅 Mês a mês</div>
      <div class="fin-legenda"><span class="fin-swatch entrada"></span>Entradas <span class="fin-swatch saida"></span>Saídas</div>
      <div class="fin-barras" data-anima="estoque-adm-barras:${meses.map(m => m.entradas + '/' + m.saidas).join(',')}">
        ${meses.map(m => `
          <div class="fin-barra-mes" title="${escapeHtml(nomeDoMes(m.mes))}: entrou ${m.entradas} un, saiu ${m.saidas} un">
            <div class="fin-barra-par">
              <div class="fin-barra entrada" style="height:${Math.round((m.entradas / maior) * 100)}%;"></div>
              <div class="fin-barra saida" style="height:${Math.round((m.saidas / maior) * 100)}%;"></div>
            </div>
            <div class="barra-mes-nome">${escapeHtml(nomeCurtoDoMes(m.mes))}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderMovimentar() {
  const d = dados();
  const p = painelEstoqueAdm(d.itens, d.movimentos);
  // O formulario vem logo abaixo dos botoes; o mes a mes, depois dele.
  return `
    ${aviso()}
    ${painelMovimentar(p)}
    ${state.estoqueAdmForm ? formularioMovimento() : ''}
    ${p.meses.length ? barrasPorMes(p.meses) : ''}
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

// O Relatorio em duas colunas (17/11/2026): a verde com as entradas e a
// vermelha com as saidas, lado a lado, sem se misturar. Cada lancamento e
// uma linha fina (nome, quantidade, data); tocar abre os detalhes e o
// "anular". Os anulados ficam dobrados no fim de cada coluna, e la cada um
// pode ser excluido de vez.
function linhaMovimento(m) {
  const saida = m.tipo === 'saida';
  const aberto = state.estoqueAdmMovAberto === m.id;
  const data = formatDataBR(m.data);
  return `
    <button class="estoque-adm-mov${m.anulado ? ' anulado' : ''}${aberto ? ' aberta' : ''}" data-action="estoque-adm-mov-abrir" data-id="${escapeHtml(m.id)}" aria-expanded="${aberto}">
      <span class="estoque-adm-mov-nome">${escapeHtml(m.material)}</span>
      <b>${m.quantidade} un</b>
      <small>${escapeHtml(data.slice(0, 5))}${saida && m.destinoNome ? ` · → ${escapeHtml(m.destinoNome)}` : ''}</small>
    </button>
    ${aberto ? detalheMovimento(m, data) : ''}
  `;
}

function detalheMovimento(m, data) {
  const saida = m.tipo === 'saida';
  const anulando = state.estoqueAdmAnularId === m.id;
  const excluindo = state.estoqueAdmExcluirId === m.id;
  const travado = state.estoqueAdmSalvando ? 'disabled' : '';
  let acao;
  if (m.anulado) {
    acao = `
      <div class="estoque-adm-anulado">Anulado${m.anuladoEm ? ` em ${escapeHtml(m.anuladoEm)}` : ''}</div>
      ${excluindo ? `
        <div class="alert" style="margin:8px 0 0;"><div class="alert-msg">Excluir de vez? Some da tela e da planilha. Fica anotado no 📜 Registros.</div>
          <div class="row-gap" style="margin-top:8px;"><button class="btn danger" data-action="estoque-adm-excluir-confirmar" data-id="${escapeHtml(m.id)}" ${travado}>Excluir</button><button class="btn secondary" data-action="estoque-adm-excluir-cancelar">Cancelar</button></div></div>
      ` : `<button class="btn ghost estoque-adm-mov-botao" data-action="estoque-adm-excluir-pedir" data-id="${escapeHtml(m.id)}">🗑️ Excluir de vez</button>`}`;
  } else {
    acao = anulando ? `
      <div class="alert" style="margin:8px 0 0;"><div class="alert-msg">Anular este lançamento? O saldo será recalculado e ele vai pros anulados, no fim da coluna.</div>
        <div class="row-gap" style="margin-top:8px;"><button class="btn danger" data-action="estoque-adm-anular-confirmar" data-id="${escapeHtml(m.id)}" ${travado}>Anular</button><button class="btn secondary" data-action="estoque-adm-anular-cancelar">Cancelar</button></div></div>
    ` : `<button class="btn ghost estoque-adm-mov-botao" data-action="estoque-adm-anular-pedir" data-id="${escapeHtml(m.id)}">Corrigir: anular lançamento</button>`;
  }
  return `
    <div class="estoque-adm-mov-detalhe">
      <div>📅 ${escapeHtml(data)}</div>
      ${saida && m.destinoNome ? `<div>➡️ Para ${escapeHtml(m.destinoNome)}</div>` : ''}
      ${m.observacao ? `<div>📝 ${escapeHtml(m.observacao)}</div>` : ''}
      ${acao}
    </div>
  `;
}

function colunaMovimentos(tipo) {
  const entrada = tipo === 'entrada';
  const todos = dados().movimentos.filter(m => m.tipo === tipo);
  const validos = todos.filter(m => !m.anulado);
  const anulados = todos.filter(m => m.anulado);
  const total = validos.reduce((s, m) => s + (Number(m.quantidade) || 0), 0);
  const abertos = state.estoqueAdmAnuladosAbertos === tipo;
  return `
    <div class="card estoque-adm-coluna ${tipo}">
      <div class="estoque-adm-coluna-titulo">${entrada ? '🟢 Entradas' : '🔴 Saídas'}</div>
      <div class="estoque-adm-coluna-total">${total} un · ${validos.length} ${validos.length === 1 ? 'lançamento' : 'lançamentos'}</div>
      ${validos.length ? validos.map(linhaMovimento).join('') : `<div class="estoque-adm-coluna-vazia">${entrada ? 'Nenhuma entrada ainda.' : 'Nenhuma saída ainda.'}</div>`}
      ${anulados.length ? `
        <button class="estoque-adm-anulados" data-action="estoque-adm-anulados" data-value="${tipo}" aria-expanded="${abertos}">🗂️ ${anulados.length} ${anulados.length === 1 ? 'anulado' : 'anulados'} <i>${abertos ? '▾' : '▸'}</i></button>
        ${abertos ? anulados.map(linhaMovimento).join('') : ''}
      ` : ''}
    </div>
  `;
}

function relatorioAtual() {
  const d = dados();
  return relatorioEstoqueAdm(d.itens, d.movimentos, 'todos');
}

function renderRelatorio() {
  return `
    ${aviso()}
    <div class="card no-print">
      <div class="painel-titulo">📊 Relatório do estoque</div>
      <div class="fin-explica">Saldo de cada material e todas as entradas e saídas. Lançamento anulado fica de fora. Toque num lançamento para ver os detalhes.</div>
      ${botaoGerarRelatorio('estoque-adm-relatorio', [
        { acao: 'estoque-adm-relatorio-texto', rotulo: '📋 WhatsApp' },
        { acao: 'estoque-adm-relatorio-pdf', rotulo: '📄 PDF' },
        { acao: 'estoque-adm-relatorio-imagem', rotulo: '🖼️ Imagem' },
      ], 'margin-top:4px;')}
    </div>
    <div class="estoque-adm-colunas">
      ${colunaMovimentos('entrada')}
      ${colunaMovimentos('saida')}
    </div>
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
    // Tocar de novo no botao que ja esta aberto fecha o formulario.
    const tipo = target.dataset.value;
    state.estoqueAdmForm = state.estoqueAdmForm && state.estoqueAdmForm.tipo === tipo ? null : novoForm(tipo);
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
  // O relatorio pro grupo: texto, PDF (o mesmo texto, impresso) e imagem.
  'estoque-adm-relatorio-texto': async (id, target, action, e) => copiarTexto(textoRelatorioEstoqueAdm(relatorioAtual())),
  'estoque-adm-relatorio-pdf': async (id, target, action, e) => imprimirTexto(textoRelatorioEstoqueAdm(relatorioAtual())),
  'estoque-adm-relatorio-imagem': async (id, target, action, e) => {
    const r = relatorioAtual();
    return mostrarPreviaImagem(() => imagensRelatorioEstoqueAdm(r), 'estoque-adm-relatorio.png');
  },
  'estoque-adm-mov-abrir': async (id, target, action, e) => {
    state.estoqueAdmMovAberto = state.estoqueAdmMovAberto === id ? null : id;
    state.estoqueAdmAnularId = null;
    state.estoqueAdmExcluirId = null;
    return render();
  },
  'estoque-adm-anulados': async (id, target, action, e) => {
    const tipo = target.dataset.value;
    state.estoqueAdmAnuladosAbertos = state.estoqueAdmAnuladosAbertos === tipo ? null : tipo;
    return render();
  },
  'estoque-adm-excluir-pedir': async (id, target, action, e) => { state.estoqueAdmExcluirId = id; return render(); },
  'estoque-adm-excluir-cancelar': async (id, target, action, e) => { state.estoqueAdmExcluirId = null; return render(); },
  'estoque-adm-excluir-confirmar': async (id, target, action, e) => {
    if (state.estoqueAdmSalvando) return;
    state.estoqueAdmSalvando = true; state.estoqueAdmMsg = null; render();
    try {
      const r = await api('estoqueAdmExcluir', { id });
      state.estoqueAdmDados = { itens:r.itens || [], movimentos:r.movimentos || [] };
      state.estoqueAdmMsg = { ok:true, texto:'Lançamento anulado excluído.' };
      state.estoqueAdmExcluirId = null;
      state.estoqueAdmMovAberto = null;
    } catch (e) { state.estoqueAdmMsg = { ok:false, texto:e.message }; }
    state.estoqueAdmSalvando = false; render();
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
      state.estoqueAdmMovAberto = null;
    } catch (e) { state.estoqueAdmMsg = { ok:false, texto:e.message }; }
    state.estoqueAdmSalvando = false; render();
  },
};
