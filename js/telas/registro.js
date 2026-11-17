// 📜 Registros (17/11/2026): tudo o que foi gravado pelo app nos ultimos 90
// dias, do mais recente pro mais antigo, com os erros em vermelho - pra
// achar o que aconteceu quando alguem relata um problema. Quem escreve e o
// Code.gs (executarERegistrar e receberErroDoApp); aqui so se le.
//
// So o Regional: o botao so aparece no menu do organizador do Regional, e
// a planilha recusa a leitura com qualquer outro PIN.

import { api } from '../nucleo/api.js';
import { escoposEmOrdemDeExibicao } from '../nucleo/config.js';
import { state } from '../nucleo/estado.js';
import { motivoLegivel } from '../nucleo/falhas.js';
import { render } from '../nucleo/render.js';
import { escapeHtml, formatDataBR, hojeISO } from '../nucleo/util.js';

// Quantas linhas por vez. O "Ver mais" busca as seguintes.
const POR_VEZ = 150;
// O filtro das gravacoes sem PIN: presenca e ficha de admissao.
const SEM_PIN = 'Sem PIN';

export async function abrirRegistro() {
  state.view = 'registro';
  return carregarRegistro(false);
}

async function carregarRegistro(mais) {
  const atuais = mais ? (state.registroLinhas || []) : [];
  const ultima = atuais[atuais.length - 1];
  if (mais) state.registroMais = true;
  else { state.registroCarregando = true; state.registroLinhas = null; }
  state.registroErro = null;
  render();
  try {
    const r = await api('registro', {
      soErros: state.registroSoErros ? '1' : '',
      divisao: state.registroDivisao || '',
      antesDe: mais && ultima ? ultima.quando : '',
      limite: POR_VEZ,
    });
    state.registroLinhas = atuais.concat(r.linhas || []);
    state.registroTemMais = !!r.temMais;
  } catch (e) {
    state.registroErro = e.message;
    if (!mais) state.registroLinhas = null;
  }
  state.registroCarregando = false;
  state.registroMais = false;
  render();
}

// "2026-11-17 14:32:05" -> { dia: '2026-11-17', hora: '14:32' }
function partes(momento) {
  const t = String(momento || '');
  return { dia: t.slice(0, 10), hora: t.slice(11, 16) };
}

function tituloDoDia(dia) {
  const hoje = hojeISO();
  const ontem = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const rotulo = dia === hoje ? 'Hoje · ' : dia === ontem ? 'Ontem · ' : '';
  return rotulo + formatDataBR(dia);
}

function linhaRegistro(l) {
  const { hora } = partes(l.quando);
  return `
    <div class="registro-linha${l.ok ? '' : ' erro'}">
      <div class="registro-topo">
        <span class="registro-hora">${escapeHtml(hora)}</span>
        <b>${l.ok ? '' : '❌ '}${escapeHtml(l.acao)}</b>
        <span class="registro-quem">${escapeHtml(l.divisao)}</span>
      </div>
      ${l.detalhe ? `<div class="registro-detalhe">${escapeHtml(l.detalhe)}</div>` : ''}
      ${l.ok ? '' : `<div class="registro-erro">${escapeHtml(motivoLegivel(l.erro))}</div>`}
      ${l.aparelho ? `<div class="registro-aparelho">📱 ${escapeHtml(l.aparelho)}</div>` : ''}
    </div>
  `;
}

// Separadas por dia, com o titulo do dia em cima.
function listaPorDia(linhas) {
  let diaAtual = '';
  return linhas.map(l => {
    const { dia } = partes(l.quando);
    const titulo = dia !== diaAtual ? `<div class="registro-dia">${escapeHtml(tituloDoDia(dia))}</div>` : '';
    diaAtual = dia;
    return titulo + linhaRegistro(l);
  }).join('');
}

function filtros() {
  const divisoes = escoposEmOrdemDeExibicao().map(e => ({ valor: e.nome, rotulo: e.nome.replace(' - RJ4', '') }))
    .concat([{ valor: SEM_PIN, rotulo: 'Sem PIN' }]);
  const chip = (acao, valor, ativo, rotulo) =>
    `<button class="chip-option ${ativo ? 'active' : ''}" data-action="${acao}" data-value="${escapeHtml(valor)}">${rotulo}</button>`;
  return `
    <div class="card registro-filtros">
      <div class="fin-explica" style="margin-top:0;">Tudo o que foi gravado pelo app nos últimos 90 dias, do mais recente pro mais antigo. Os erros ficam em vermelho, com o motivo. "Sem PIN" são as confirmações de presença e as fichas de admissão.</div>
      <div class="registro-chips">
        ${chip('registro-erros', '0', !state.registroSoErros, 'Tudo')}
        ${chip('registro-erros', '1', state.registroSoErros, '❌ Só erros')}
      </div>
      <div class="registro-chips">
        ${chip('registro-divisao', '', !state.registroDivisao, 'Todas')}
        ${divisoes.map(d => chip('registro-divisao', d.valor, state.registroDivisao === d.valor, escapeHtml(d.rotulo))).join('')}
      </div>
      <button class="btn secondary block" data-action="registro-atualizar" style="margin-top:10px;" ${state.registroCarregando ? 'disabled' : ''}>🔄 Atualizar</button>
    </div>
  `;
}

function conteudo() {
  if (state.registroCarregando) return '<div class="loading">Carregando o registro…</div>';
  if (state.registroErro && !state.registroLinhas) return `<div class="alert"><div class="alert-msg">${escapeHtml(motivoLegivel(state.registroErro))}</div></div>`;
  const linhas = state.registroLinhas || [];
  if (!linhas.length) {
    return `<div class="empty">${state.registroSoErros || state.registroDivisao ? 'Nada com este filtro.' : 'Nada registrado ainda.'}</div>`;
  }
  return `
    <div class="card registro-lista">${listaPorDia(linhas)}</div>
    ${state.registroErro ? `<div class="alert"><div class="alert-msg">${escapeHtml(motivoLegivel(state.registroErro))}</div></div>` : ''}
    ${state.registroTemMais ? `<button class="btn secondary block" data-action="registro-mais" ${state.registroMais ? 'disabled' : ''}>${state.registroMais ? 'Carregando…' : 'Ver mais antigos'}</button>` : ''}
  `;
}

export function renderRegistro(app) {
  app.innerHTML = `
    <div class="back-link on-photo" data-action="go-menu-organizador">‹ Menu do organizador</div>
    <div class="event-header">
      <h1 style="font-size:20px;">📜 Registros</h1>
      <div class="count-box">REGIONAL RJ4</div>
    </div>
    ${filtros()}
    ${conteudo()}
  `;
}

export const acoes = {
  'abrir-registro': async (id, target, action, e) => abrirRegistro(),
  'registro-atualizar': async (id, target, action, e) => carregarRegistro(false),
  'registro-mais': async (id, target, action, e) => {
    if (state.registroMais) return;
    return carregarRegistro(true);
  },
  'registro-erros': async (id, target, action, e) => {
    state.registroSoErros = target.dataset.value === '1';
    return carregarRegistro(false);
  },
  'registro-divisao': async (id, target, action, e) => {
    state.registroDivisao = target.dataset.value;
    return carregarRegistro(false);
  },
};
