// A pagina Atualizar-cadastro (cadastro.html, 27/11/2026): o link que o
// Regional manda pro grupo. O irmao toca na divisao, no proprio nome e
// completa o que falta na carteirinha dele - telefone, nascimento, contato
// de emergencia, saude e a data de entrada no clube.
//
// E uma pagina A PARTE do app, irma da ficha.html e da mesa.html: nao tem
// menu, calendario nem rank, nao pede PIN e nao leva a lugar nenhum dele.
// O desenho de cada tela mora em telas/cadastro.js; as regras dos campos,
// em dominio/cadastro-link.js; aqui ficam o estado, os toques e as idas a
// planilha (cadastroLista e cadastroCompletar, publicas, no Code.gs).
//
// Ninguem le dado nenhum por aqui: a planilha diz so QUAIS campos faltam, e
// so grava campo vazio. O formulario e desenhado UMA vez (redesenhar a cada
// toque fecharia o teclado do celular): as escolhas e as mascaras mexem
// direto no elemento, como na ficha do pretendente.

import { api, apiPost } from './nucleo/api.js';
import { motivoLegivel } from './nucleo/falhas.js';
import { dataISOdeBR, hojeISO, mascaraData } from './nucleo/util.js';
import { campoVisivel, mascaraTelefone } from './dominio/admissao.js';
import { CAMPOS_CADASTRO, cadastroParaEnvio, conferirCadastro } from './dominio/cadastro-link.js';
import { htmlCadastro } from './telas/cadastro.js';

const raiz = document.getElementById('app');

const c = { tela: 'carregando', membros: null, erro: null, escopo: null, membroId: null };
let escolhas = {}, sujo = false, enviando = false;

function desenhar() {
  raiz.innerHTML = htmlCadastro(c);
  if (c.tela === 'form') ligarFormulario();
}

function irPara(tela) {
  c.tela = tela;
  desenhar();
  window.scrollTo(0, 0);
}

const membroAberto = () => (c.membros || []).find(m => m.id === c.membroId) || null;

// ---------- buscar ----------

async function buscar() {
  c.tela = 'carregando';
  c.erro = null;
  desenhar();
  try {
    const r = await api('cadastroLista');
    if (!r.aberto) return irPara('fechado');
    c.membros = r.membros || [];
    irPara(c.escopo ? 'lista' : 'cards');
  } catch (e) {
    c.erro = motivoLegivel(e.message);
    irPara('erro');
  }
}

// ---------- o formulario ----------

function marcarEscolha(chave, valor) {
  escolhas[chave] = valor;
  raiz.querySelectorAll(`.chip-option[data-campo="${chave}"]`).forEach(b => b.classList.toggle('active', b.dataset.valor === valor));
  limparErro(chave);
  // O "Qual?" so no Sim.
  CAMPOS_CADASTRO.filter(x => x.soSe && x.soSe[0] === chave).forEach(x => {
    const bloco = raiz.querySelector(`[data-bloco="${x.chave}"]`);
    if (bloco) bloco.hidden = !campoVisivel(x, escolhas);
  });
}

function limparErro(chave) {
  const bloco = raiz.querySelector(`[data-bloco="${chave}"]`);
  if (!bloco || !bloco.classList.contains('com-erro')) return;
  bloco.classList.remove('com-erro');
  bloco.querySelector('.ficha-erro-msg').textContent = '';
}

const MASCARA = { telefone: mascaraTelefone, data: mascaraData };

function ligarFormulario() {
  const form = document.getElementById('cad-form');
  if (!form) return;
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.chip-option[data-campo]');
    if (!b) return;
    sujo = true;
    marcarEscolha(b.dataset.campo, b.dataset.valor);
  });
  form.addEventListener('input', (e) => {
    const chave = e.target.dataset.campo;
    if (!chave) return;
    sujo = true;
    const campo = CAMPOS_CADASTRO.find(x => x.chave === chave);
    if (campo && MASCARA[campo.tipo]) e.target.value = MASCARA[campo.tipo](e.target.value);
    limparErro(chave);
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); enviar(); });
}

function lerValores() {
  const valores = {};
  CAMPOS_CADASTRO.forEach(campo => {
    if (campo.tipo === 'escolha') { valores[campo.chave] = escolhas[campo.chave] || ''; return; }
    const bruto = (document.getElementById(`f-${campo.chave}`) || {}).value || '';
    // A data vai em ISO; o que nao virou data fica como foi escrito, pra
    // conferencia acusar em vez de sumir calado.
    valores[campo.chave] = campo.tipo === 'data' && bruto.trim() ? (dataISOdeBR(bruto) || bruto) : bruto;
  });
  return valores;
}

function mostrarErros(erros) {
  raiz.querySelectorAll('.ficha-campo.com-erro').forEach(b => {
    b.classList.remove('com-erro');
    b.querySelector('.ficha-erro-msg').textContent = '';
  });
  erros.forEach(({ chave, msg }) => {
    const bloco = raiz.querySelector(`[data-bloco="${chave}"]`);
    if (!bloco || bloco.classList.contains('com-erro')) return;
    bloco.classList.add('com-erro');
    bloco.querySelector('.ficha-erro-msg').textContent = msg;
  });
  aviso(!erros.length ? '' : erros.length === 1 ? 'Falta 1 coisa - está marcada em vermelho.' : `Faltam ${erros.length} coisas - estão marcadas em vermelho.`);
  const primeira = raiz.querySelector('.ficha-campo.com-erro');
  if (primeira) primeira.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function aviso(texto) {
  const resumo = document.getElementById('cad-resumo-erros');
  if (!resumo) return;
  resumo.hidden = !texto;
  resumo.textContent = texto;
}

async function enviar() {
  const m = membroAberto();
  if (enviando || !m) return;
  const valores = lerValores();
  const erros = conferirCadastro(valores, m.falta, hojeISO());
  mostrarErros(erros);
  if (erros.length) return;

  const botao = document.getElementById('cad-enviar');
  enviando = true;
  botao.disabled = true;
  botao.textContent = 'Enviando…';
  try {
    const r = await apiPost('cadastroCompletar', {
      ...cadastroParaEnvio(valores, m.falta),
      membroId: m.id,
      site: document.getElementById('f-site').value,
    });
    m.falta = r.falta || [];
    sujo = false;
    irPara('enviado');
  } catch (e) {
    aviso(e instanceof TypeError
      ? 'Não deu pra enviar. Confira a internet e toque em "Enviar" de novo - nada do que você escreveu se perdeu.'
      : `Não deu pra enviar: ${motivoLegivel(e.message)}`);
    botao.disabled = false;
    botao.textContent = 'Enviar';
    // O Regional fechou o link enquanto ele preenchia.
    if (/prazo/i.test(e.message || '')) c.membros = null;
  } finally {
    enviando = false;
  }
}

// Sair do formulario com coisa escrita: confirma antes de jogar fora.
function podeSair() {
  if (c.tela !== 'form' || !sujo) return true;
  if (!window.confirm('Sair sem enviar? O que você escreveu vai se perder.')) return false;
  sujo = false;
  return true;
}

// ---------- os toques ----------

const TOQUES = {
  divisao: (alvo) => { c.escopo = alvo.dataset.value; irPara('lista'); },
  cards: () => { c.escopo = null; irPara('cards'); },
  abrir: (alvo) => {
    c.membroId = alvo.dataset.id;
    escolhas = {};
    sujo = false;
    irPara('form');
  },
  lista: () => {
    if (!podeSair()) return;
    c.membroId = null;
    // A lista e buscada de novo: outros irmaos podem ter completado nesse meio tempo.
    buscar();
  },
  recarregar: () => buscar(),
};

raiz.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-cad]');
  if (!alvo || alvo.disabled) return;
  const toque = TOQUES[alvo.dataset.cad];
  if (toque) toque(alvo);
});

window.addEventListener('beforeunload', (e) => {
  if (c.tela === 'form' && sujo) { e.preventDefault(); e.returnValue = ''; }
});

buscar();
