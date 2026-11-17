// Os erros que acontecem na TELA do celular (17/11/2026): um botao que
// quebra, uma tela que nao desenha. Vao pro Registro (acao erroApp no
// Code.gs), com a tela em que a pessoa estava e o aparelho - assim da pra
// achar o que aconteceu mesmo quando ninguem sabe explicar.
//
// Os erros da planilha (a gravacao recusada, a internet que caiu) NAO vem
// por aqui: a recusa ja e anotada pela propria planilha, e sem internet nao
// ha como mandar. O api() marca esses com `daPlanilha`.

import { apiBeacon } from '../nucleo/api.js';
import { state } from '../nucleo/estado.js';

// No maximo 5 por vez que o app e aberto, e o mesmo erro uma vez so.
const MAXIMO = 5;
const enviados = new Set();

// "Android 14 · Chrome", "iPhone iOS 17 · Safari", "Windows · Edge".
export function aparelhoCurto(ua) {
  const t = String(ua || '');
  const android = /Android (\d+)/.exec(t);
  const ios = /(iPhone|iPad).*? OS (\d+)/.exec(t);
  const sistema = android ? 'Android ' + android[1] : ios ? ios[1] + ' iOS ' + ios[2]
    : /Windows/.test(t) ? 'Windows' : /Mac OS/.test(t) ? 'Mac' : /Linux/.test(t) ? 'Linux' : 'Outro';
  const navegador = /SamsungBrowser/.test(t) ? 'Samsung' : /Edg\//.test(t) ? 'Edge' : /OPR\//.test(t) ? 'Opera'
    : /Firefox|FxiOS/.test(t) ? 'Firefox' : /Chrome|CriOS/.test(t) ? 'Chrome' : /Safari/.test(t) ? 'Safari' : 'Outro';
  return sistema + ' · ' + navegador;
}

// Em que tela a pessoa estava: a view e, no organizador, a aba.
function telaAtual() {
  return [state.view, state.view === 'admin' ? state.adminTab : ''].filter(Boolean).join(' · ');
}

// Ruido de navegador que nao diz nada: erro de script de outro site (o
// navegador esconde o texto) e o aviso do ResizeObserver.
function eRuido(msg) { return !msg || /^Script error\.?$/i.test(msg) || /ResizeObserver loop/i.test(msg); }

function mandar(mensagem) {
  const msg = String(mensagem || '').trim();
  if (eRuido(msg) || enviados.has(msg) || enviados.size >= MAXIMO) return;
  enviados.add(msg);
  try {
    apiBeacon('erroApp', { mensagem: msg, tela: telaAtual(), escopo: state.adminEscopo || '', aparelho: aparelhoCurto(navigator.userAgent) });
  } catch (e) { /* sem como avisar - e nao pode virar outro erro */ }
}

// Ligado uma vez, na partida do app.
export function ligarErrosDeTela() {
  window.addEventListener('error', (e) => {
    const onde = e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ')' : '';
    mandar((e.message || (e.error && e.error.message) || '') + onde);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if (r && r.daPlanilha) return;
    mandar(r && r.message ? r.message : String(r || ''));
  });
}
