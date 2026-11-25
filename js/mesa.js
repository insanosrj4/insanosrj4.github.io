// A pagina da Mesa (mesa.html, 25/11/2026): o link aberto pros integrantes
// de mesa do clube. Abre com os cards das divisoes; tocar num card pede o
// PIN daquela divisao (o mesmo do Modo organizador - o do Regional abre
// qualquer uma) e mostra as fichas de admissao Em analise, pra copiar os
// dados pro sistema oficial do M.C., aprovar (o irmao entra no app) ou
// marcar que desistiu (a ficha e apagada).
//
// E uma pagina A PARTE do app, irma da ficha.html: nao tem menu, calendario
// nem rank, e nao leva a lugar nenhum dele. O desenho de cada tela mora em
// telas/mesa.js; aqui ficam o estado, os toques e as idas a planilha. As
// acoes sao as mesmas do card Pretendentes do organizador (pretendentes,
// pretendenteAprovar, pretendenteRemover), com o PIN conferido contra a
// divisao da ficha no Code.gs - e com origem 'mesa', pro Registro dizer que
// veio daqui.
//
// O PIN fica so na memoria da pagina: o "Sair" e o recarregar pedem de novo.

import { api } from './nucleo/api.js';
import { state } from './nucleo/estado.js';
import { copiarSemAviso, imprimirTexto, mostrarAviso } from './nucleo/util.js';
import { CAMPOS_FICHA, nomeDivisaoAdmissao, textoFichaAdmissao, valorLegivel } from './dominio/admissao.js';
import { htmlMesa } from './telas/mesa.js';

const raiz = document.getElementById('app');

const m = {
  tela: 'cards', escopo: null,
  contagem: null, contagemErro: false,
  pinVerificando: false, pinErro: null,
  dados: null, carregando: false, erro: null,
  aberto: null, confirmar: null, salvando: false,
  roster: null,
};

function desenhar() {
  raiz.innerHTML = htmlMesa(m);
  if (m.tela === 'pin') {
    const campo = document.getElementById('mesa-pin');
    if (campo && !m.pinVerificando) {
      campo.focus();
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
    }
  }
}

const fichaAberta = () => (m.dados || []).find(p => p.id === m.aberto) || null;

// ---------- buscar ----------

async function contar() {
  try {
    const r = await api('pretendentesContagem');
    m.contagem = r.contagem || {};
    m.contagemErro = false;
  } catch (e) {
    m.contagemErro = true;
  }
  if (m.tela === 'cards') desenhar();
}

async function buscarFichas() {
  m.carregando = true;
  m.erro = null;
  desenhar();
  try {
    const r = await api('pretendentes', { divisao: m.escopo });
    m.dados = r.pretendentes || [];
  } catch (e) {
    m.erro = e.message;
  }
  m.carregando = false;
  desenhar();
}

// O cadastro, so pro aviso de nome repetido no Aprovar. Publico (a mesma
// lista que a tela inicial do app usa); se falhar, o aviso so nao aparece.
async function buscarCadastro() {
  if (m.roster) return;
  try {
    const r = await api('dados');
    m.roster = r.membros || [];
    if (m.confirmar) desenhar();
  } catch (e) { /* sem o aviso de nome repetido */ }
}

// ---------- o PIN ----------

async function entrar() {
  if (m.pinVerificando) return;
  const campo = document.getElementById('mesa-pin');
  const pin = campo ? campo.value.trim() : '';
  if (!pin) return;
  m.pinVerificando = true;
  m.pinErro = null;
  desenhar();
  try {
    const r = await api('verificarPin', { escopo: m.escopo, pin });
    if (r.valido) {
      // O api() junta o PIN nas acoes protegidas (ver comCredencial).
      state.pinAtual = { escopo: m.escopo, pin };
      m.tela = 'lista';
      m.dados = null;
      m.pinVerificando = false;
      buscarCadastro();
      return buscarFichas();
    }
    m.pinErro = 'PIN incorreto.';
  } catch (e) {
    m.pinErro = 'Não consegui verificar (' + e.message + '). Tente de novo.';
  }
  m.pinVerificando = false;
  desenhar();
}

function sair() {
  state.pinAtual = null;
  Object.assign(m, { tela: 'cards', escopo: null, dados: null, erro: null, aberto: null, confirmar: null, pinErro: null });
  desenhar();
  window.scrollTo(0, 0);
  contar();
}

// ---------- aprovar e desistiu ----------

function tirarDaLista(p) {
  m.dados = (m.dados || []).filter(x => x.id !== p.id);
  if (m.contagem && m.contagem[p.divisao]) m.contagem[p.divisao]--;
  m.aberto = null;
  m.confirmar = null;
  m.tela = 'lista';
}

async function aprovar(id) {
  const p = fichaAberta();
  if (!p || p.id !== id || !m.confirmar || m.salvando) return;
  const destino = p.divisao === 'regional' ? m.confirmar.destino : p.divisao;
  if (!destino) return;
  m.salvando = true;
  desenhar();
  try {
    const r = await api('pretendenteAprovar', { id, destino, origem: 'mesa' });
    tirarDaLista(p);
    mostrarAviso(`✅ ${p.nomeColete} entrou na ${nomeDivisaoAdmissao(r.divisao || destino)}`);
    window.scrollTo(0, 0);
  } catch (e) {
    // O balao do api() ja explica o erro (nucleo/falhas.js).
  }
  m.salvando = false;
  desenhar();
}

async function desistiu(id) {
  const p = fichaAberta();
  if (!p || p.id !== id || m.salvando) return;
  m.salvando = true;
  desenhar();
  try {
    await api('pretendenteRemover', { id, origem: 'mesa' });
    tirarDaLista(p);
    mostrarAviso(`❌ Ficha de ${p.nomeColete || 'pretendente'} apagada`);
    window.scrollTo(0, 0);
  } catch (e) {
    // O balao do api() ja explica o erro.
  }
  m.salvando = false;
  desenhar();
}

// ---------- copiar ----------

async function copiar(texto, aviso) {
  mostrarAviso(await copiarSemAviso(texto) ? aviso : 'Não consegui copiar. Tente de novo.');
}

// ---------- os toques ----------

function abrirConfirmando(id, tipo) {
  m.aberto = id;
  m.confirmar = { tipo, destino: null };
  m.tela = 'ficha';
  desenhar();
  window.scrollTo(0, 0);
}

const TOQUES = {
  escolher: (alvo) => {
    m.escopo = alvo.dataset.value;
    m.tela = 'pin';
    m.pinErro = null;
    desenhar();
  },
  cards: () => sair(),
  entrar: () => entrar(),
  sair: () => sair(),
  recarregar: () => buscarFichas(),
  abrir: (alvo) => {
    m.aberto = alvo.dataset.id;
    m.confirmar = null;
    m.tela = 'ficha';
    desenhar();
    window.scrollTo(0, 0);
  },
  // O ✅ Aprovar e o ❌ Desistiu da lista abrem a ficha ja com a
  // confirmacao: nada e gravado no primeiro toque, e quem confirma ve os
  // dados antes (pedido do Social Regional, 25/11/2026: evitar toque errado).
  'aprovar-linha': (alvo) => abrirConfirmando(alvo.dataset.id, 'aprovar'),
  'desistiu-linha': (alvo) => abrirConfirmando(alvo.dataset.id, 'desistiu'),
  fechar: () => {
    m.aberto = null;
    m.confirmar = null;
    m.tela = 'lista';
    desenhar();
  },
  confirmar: (alvo) => {
    const tipo = alvo.dataset.value;
    m.confirmar = m.confirmar && m.confirmar.tipo === tipo ? null : { tipo, destino: null };
    desenhar();
  },
  cancelar: () => { m.confirmar = null; desenhar(); },
  destino: (alvo) => { if (m.confirmar) m.confirmar.destino = alvo.dataset.value; desenhar(); },
  aprovar: (alvo) => aprovar(alvo.dataset.id),
  desistiu: (alvo) => desistiu(alvo.dataset.id),
  copiar: (alvo) => {
    const p = fichaAberta();
    const campo = CAMPOS_FICHA.find(c => c.chave === alvo.dataset.campo);
    if (!p || !campo) return;
    // A data sai como se escreve (21/05/1990), e o "Nao" com acento.
    return copiar(valorLegivel(campo, p[campo.chave]), `📋 ${campo.rotulo} copiado`);
  },
  'copiar-tudo': () => { const p = fichaAberta(); if (p) copiar(textoFichaAdmissao(p), '📋 Ficha inteira copiada'); },
  pdf: () => { const p = fichaAberta(); if (p) imprimirTexto(textoFichaAdmissao(p)); },
};

raiz.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-mesa]');
  if (!alvo || alvo.disabled) return;
  const toque = TOQUES[alvo.dataset.mesa];
  if (toque) toque(alvo);
});

desenhar();
contar();
