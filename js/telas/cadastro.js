// O desenho da pagina Atualizar-cadastro (cadastro.html, 27/11/2026): o
// irmao acha o proprio nome e completa o que falta na carteirinha. Aqui so
// o HTML de cada tela, a partir do estado da pagina - quem busca, grava e
// responde ao toque e o js/cadastro.js. Separado assim pro
// ferramentas/telas.mjs conseguir desenhar cada tela.
//
// As telas:
//   carregando - buscando a lista na planilha;
//   erro       - nao deu pra buscar (com o "Tentar de novo");
//   fechado    - o Regional fechou o link;
//   cards      - as 7 divisoes na ordem oficial, com quantos ja completaram;
//   lista      - os irmaos da divisao, um card por grau (como em Membros);
//   form       - o que falta na carteirinha de um irmao;
//   enviado    - a confirmacao.
// Os botoes levam data-cad (e nao data-action): a pagina nao e o app, e nao
// leva a lugar nenhum dele.

import { escoposNaOrdemOficial } from '../nucleo/config.js';
import { IMG_DIVISAO, IMG_REGIONAL, LOGO_SRC } from '../nucleo/imagens.js';
import { escapeHtml, ordenarPorHierarquia } from '../nucleo/util.js';
import { nomeDivisaoAdmissao } from '../dominio/admissao.js';
import { cadastroCompleto, jaInformados, partesQueFaltam, resumoDoCadastro } from '../dominio/cadastro-link.js';

const rodape = '<div class="footer-admin"><div class="brand-tag">INSANOS MC · REGIONAL RJ4</div></div>';

function cabecalho(sub) {
  return `
    <div class="crest-wrap">
      <img src="${LOGO_SRC}" alt="Insanos MC">
      <h1>Atualizar cadastro</h1>
      <div class="sub">${escapeHtml(sub)}</div>
    </div>`;
}

// Os irmaos de uma divisao: a lista da planilha guarda o nome dela ("Barra - RJ4").
export function membrosDaDivisao(c, chave) {
  const e = escoposNaOrdemOficial().find(x => x.chave === chave);
  return e ? (c.membros || []).filter(m => m.divisao === e.nome) : [];
}

// As iniciais no circulo, com o anel na cor do grau - as mesmas da lista de
// Membros do app (selinhoIniciais), escritas aqui pra pagina nao carregar
// as telas do app.
const NIVEL_DO_GRAU = { I: 'ouro', II: 'ouro', III: 'ouro', IV: 'ouro', V: 'ouro', VI: 'prata', VII: 'bronze', VIII: 'bronze' };
function iniciais(m) {
  const partes = String(m.nome || '').trim().split(/\s+/).filter(Boolean);
  const letras = !partes.length ? '?' : partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2);
  return `<span class="iniciais iniciais-${NIVEL_DO_GRAU[m.grau] || 'base'}" aria-hidden="true">${escapeHtml(letras.toUpperCase())}</span>`;
}

// ---------- carregando, erro e fechado ----------

function telaCarregando() {
  return `${cabecalho('Regional RJ4')}<div class="loading">Buscando os irmãos…</div>${rodape}`;
}

function telaErro(c) {
  return `
    ${cabecalho('Regional RJ4')}
    <div class="alert">
      <div class="alert-msg">Não deu pra buscar a lista agora. ${escapeHtml(c.erro || '')}</div>
      <button class="btn secondary block" data-cad="recarregar" style="margin-top:10px;">Tentar de novo</button>
    </div>
    ${rodape}`;
}

function telaFechado() {
  return `
    ${cabecalho('Regional RJ4')}
    <div class="card ficha-intro">
      <h2 class="ficha-intro-titulo">Prazo encerrado</h2>
      <p>A atualização do cadastro pelo link está fechada no momento.
      Se precisar completar ou corrigir algo na sua carteirinha, fale com o ADM da sua divisão.</p>
    </div>
    ${rodape}`;
}

// ---------- os cards ----------

function cardDivisao(c, e) {
  const regional = e.chave === 'regional';
  const fundo = `background-image:url('${regional ? IMG_REGIONAL : IMG_DIVISAO}'); background-size:cover; background-position:center;`;
  const { total, completos } = resumoDoCadastro(membrosDaDivisao(c, e.chave));
  const texto = !total ? 'ninguém cadastrado' : completos === total ? `✅ todos os ${total} completos` : `✅ ${completos} de ${total} completos`;
  return `
    <div class="card event-card ${regional ? 'card-regional-home' : 'card-divisao-home'} mesa-card" style="${fundo}" data-cad="divisao" data-value="${e.chave}">
      ${regional
        ? `<div class="event-date-badge">${escapeHtml(texto)}</div><div></div>`
        : `<div><div class="name">${escapeHtml(e.nome)}</div><div class="meta">${escapeHtml(texto)}</div></div>`}
      <div class="arrow">›</div>
    </div>`;
}

function telaCards(c) {
  return `
    ${cabecalho('Regional RJ4')}
    <div class="card ficha-intro">
      <h2 class="ficha-intro-titulo">Atualização de dados</h2>
      <p>Toque na sua divisão e depois no seu nome. Aparece só o que ainda falta na sua carteirinha - leva um minuto.</p>
      <div class="ficha-intro-nota">Seus dados ficam só com a administração do clube.</div>
    </div>
    ${escoposNaOrdemOficial().map(e => cardDivisao(c, e)).join('')}
    ${rodape}`;
}

// ---------- a lista ----------

function gruposPorGrau(membros) {
  const grupos = [];
  ordenarPorHierarquia(membros).forEach(m => {
    const grau = m.grau || '';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.grau === grau) ultimo.membros.push(m);
    else grupos.push({ grau, membros: [m] });
  });
  return grupos;
}

function linha(m) {
  const n = (m.falta || []).length;
  return `
    <div class="member-row lista-carteirinha cad-linha${m.afastado ? ' afastado' : ''}" data-cad="abrir" data-id="${escapeHtml(m.id)}">
      <div class="member-info">
        ${iniciais(m)}
        <span class="member-name">${escapeHtml(m.nome)}</span>
        ${m.grau ? `<span class="grade-box">${escapeHtml(m.grau)}</span>` : ''}
        ${m.cargo ? `<span class="member-cargo-inline">${escapeHtml(m.cargo)}</span>` : ''}
      </div>
      <span class="cad-situacao${n ? ' falta' : ''}">${n ? `📝 falta${n === 1 ? '' : 'm'} ${n}` : '✅ completo'}</span>
    </div>`;
}

function telaLista(c) {
  const membros = membrosDaDivisao(c, c.escopo);
  const { total, completos } = resumoDoCadastro(membros);
  const corpo = membros.length
    ? `<div class="pret-resumo">✅ ${completos} de ${total} completos · toque no seu nome</div>` + gruposPorGrau(membros).map(g => `
      <div class="card lista-cadastro">
        <div class="division-subheader">
          <span>${g.grau ? `GRAU ${escapeHtml(g.grau)}` : 'SEM GRAU'}</span>
          <span class="division-counts">${g.membros.length} ${g.membros.length === 1 ? 'membro' : 'membros'}</span>
        </div>
        ${g.membros.map(linha).join('')}
      </div>`).join('')
    : '<div class="empty">Ninguém cadastrado nesta divisão.</div>';
  return `
    <div class="back-link on-photo" data-cad="cards">‹ Divisões</div>
    ${cabecalho(nomeDivisaoAdmissao(c.escopo))}
    ${corpo}
    <div class="pret-explica cad-nao-achou">Não achou seu nome? Fale com o ADM da sua divisão.</div>
    ${rodape}`;
}

// ---------- o formulario ----------

const ROTULO_OPCAO = { Nao: 'Não' };

function htmlEscolha(campo) {
  const larga = campo.opcoes.length === 2;
  const quatro = campo.opcoes.length === 8;
  return `<div class="ficha-escolhas${larga ? ' larga' : ''}${quatro ? ' quatro' : ''}">${campo.opcoes.map(op =>
    `<button type="button" class="chip-option" data-campo="${campo.chave}" data-valor="${escapeHtml(op)}">${escapeHtml(ROTULO_OPCAO[op] || op)}</button>`).join('')}</div>`;
}

function htmlEntrada(campo) {
  const a = [`id="f-${campo.chave}"`, `data-campo="${campo.chave}"`, `autocomplete="${campo.auto || 'off'}"`];
  if (campo.tipo === 'data') a.push('type="text" inputmode="numeric" maxlength="10" class="campo-data" placeholder="dd/mm/aaaa"');
  else if (campo.tipo === 'telefone') a.push('type="tel" maxlength="15" placeholder="(21) 99999-9999"');
  else a.push(`type="text" maxlength="${campo.max}"`);
  if (campo.dica) a.push(`placeholder="${escapeHtml(campo.dica)}"`);
  return `<input ${a.join(' ')}>`;
}

function htmlCampo(campo) {
  return `
    <div class="field ficha-campo" data-bloco="${campo.chave}"${campo.soSe ? ' hidden' : ''}>
      <div class="ficha-rotulo">
        <label${campo.tipo === 'escolha' ? '' : ` for="f-${campo.chave}"`}>${escapeHtml(campo.rotulo)}</label>
      </div>
      ${campo.tipo === 'escolha' ? htmlEscolha(campo) : htmlEntrada(campo)}
      ${campo.ajuda ? `<div class="ficha-ajuda">${escapeHtml(campo.ajuda)}</div>` : ''}
      <div class="ficha-erro-msg"></div>
    </div>`;
}

// Quem esta preenchendo: o nome, o grau e o cargo, pra conferir que tocou
// no nome certo.
function quemE(m) {
  return `
    <div class="card cad-quem">
      ${iniciais(m)}
      <div class="cad-quem-texto">
        <div class="cad-quem-nome">${escapeHtml(m.nome)}</div>
        <div class="cad-quem-meta">${[m.grau ? `Grau ${m.grau}` : '', m.cargo, m.divisao].filter(Boolean).map(escapeHtml).join(' · ')}</div>
      </div>
    </div>`;
}

// O que ja esta na carteirinha: so o nome do dado, nunca o valor.
function htmlJaInformados(m) {
  const ja = jaInformados(m.falta);
  if (!ja.length) return '';
  return `
    <div class="card cad-ja">
      <div class="cad-ja-titulo">Já está na sua carteirinha</div>
      <div class="cad-ja-lista">${ja.map(d => `<span class="cad-ja-item">✅ ${escapeHtml(d.rotulo)}</span>`).join('')}</div>
      <div class="ficha-intro-nota">Algo errado aí? Fale com o ADM da sua divisão - pelo link só dá pra preencher o que está em branco.</div>
    </div>`;
}

function telaForm(c) {
  const m = (c.membros || []).find(x => x.id === c.membroId);
  const voltar = '<div class="back-link on-photo" data-cad="lista">‹ Voltar à lista</div>';
  if (!m) return `${voltar}${cabecalho('Regional RJ4')}<div class="empty">Irmão não encontrado.</div>${rodape}`;
  const topo = `${voltar}${cabecalho(nomeDivisaoAdmissao(c.escopo))}${quemE(m)}`;
  if (cadastroCompleto(m)) {
    return `${topo}
      <div class="card ficha-recebida">
        <div class="ficha-recebida-titulo">✅ Carteirinha completa</div>
        <p>Não falta nada na sua carteirinha, irmão. Se algo estiver errado, fale com o ADM da sua divisão.</p>
      </div>
      ${htmlJaInformados(m)}
      ${rodape}`;
  }
  return `${topo}
    <form id="cad-form" novalidate autocomplete="on">
      ${partesQueFaltam(m.falta).map(parte => `
        <section class="card ficha-parte">
          <h2 class="ficha-parte-titulo">${escapeHtml(parte.titulo)}</h2>
          <div class="ficha-campos">${parte.campos.map(htmlCampo).join('')}</div>
        </section>`).join('')}
      <!-- Campo-isca: invisivel pra gente, robo preenche. Com ele preenchido,
           o Code.gs finge que recebeu e nao grava nada. -->
      <div class="ficha-isca" aria-hidden="true">
        <label for="f-site">Site</label><input id="f-site" type="text" tabindex="-1" autocomplete="off">
      </div>
      <div id="cad-resumo-erros" class="ficha-resumo-erros" hidden></div>
      <button type="submit" class="btn block ficha-enviar" id="cad-enviar">Enviar</button>
    </form>
    ${htmlJaInformados(m)}
    ${rodape}`;
}

// ---------- depois de enviar ----------

function telaEnviado(c) {
  const m = (c.membros || []).find(x => x.id === c.membroId) || {};
  const faltou = (m.falta || []).length;
  return `
    ${cabecalho(nomeDivisaoAdmissao(c.escopo))}
    <div class="card ficha-recebida">
      <div class="ficha-recebida-titulo">✅ Recebido</div>
      <p>Valeu, <strong>${escapeHtml(m.nome || 'irmão')}</strong>! Sua carteirinha foi atualizada.</p>
      ${faltou ? `<p class="ficha-intro-nota">Ainda ${faltou === 1 ? 'falta 1 dado' : `faltam ${faltou} dados`} - toque no seu nome de novo pra completar.</p>` : ''}
    </div>
    <button class="btn secondary block" data-cad="lista">‹ Voltar à lista</button>
    ${rodape}`;
}

const TELAS = { carregando: telaCarregando, erro: telaErro, fechado: telaFechado, cards: telaCards,
  lista: telaLista, form: telaForm, enviado: telaEnviado };

export function htmlCadastro(c) {
  return (TELAS[c.tela] || telaCarregando)(c);
}
