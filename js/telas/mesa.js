// O desenho da pagina da Mesa (mesa.html, 25/11/2026): o link aberto pros
// integrantes de mesa verem os pretendentes e lancarem os dados no sistema
// oficial do M.C., sem entrar no app. Aqui so o HTML de cada tela, a partir
// do estado da pagina - quem busca, grava e responde ao toque e o js/mesa.js.
// Separado assim pro ferramentas/telas.mjs conseguir desenhar cada tela.
//
// As telas:
//   cards - os 7 cards na ordem oficial, com quantas fichas esperam em cada;
//   pin   - o PIN da divisao escolhida (o mesmo do Modo organizador);
//   lista - as fichas Em analise da divisao (no Regional, das 7, em blocos),
//           cada uma com o ✅ Aprovar ao lado;
//   ficha - os dados, cada campo com o 📋 pra copiar so ele, mais o
//           ✅ Aprovar e o ❌ Desistiu, com confirmacao.
// Os botoes levam data-mesa (e nao data-action): a pagina nao e o app.

import { escoposNaOrdemOficial } from '../nucleo/config.js';
import { IMG_DIVISAO, IMG_REGIONAL, LOGO_SRC } from '../nucleo/imagens.js';
import { escapeHtml, formatDataBR, hojeISO } from '../nucleo/util.js';
import { irmaosComMesmoNome, nomeDivisaoAdmissao, partesDoPretendente, pretendentesDaMesa,
  situacaoDe } from '../dominio/admissao.js';

const rodape = '<div class="footer-admin"><div class="brand-tag">INSANOS MC · REGIONAL RJ4</div></div>';
const nomeCurto = (chave) => nomeDivisaoAdmissao(chave).replace('Divisão ', '');
const soDigitos = (v) => String(v || '').replace(/\D/g, '');

function cabecalho(sub) {
  return `
    <div class="crest-wrap">
      <img src="${LOGO_SRC}" alt="Insanos MC">
      <h1>Mesa · Pretendentes</h1>
      <div class="sub">${escapeHtml(sub)}</div>
    </div>`;
}

// ---------- os cards ----------

// Quantas fichas esperam: o Regional ve as das 7, entao o card dele soma.
function contagemDoCard(m, chave) {
  if (!m.contagem) return '';
  const n = chave === 'regional'
    ? Object.values(m.contagem).reduce((a, b) => a + (Number(b) || 0), 0)
    : Number(m.contagem[chave]) || 0;
  if (!n) return 'nenhuma ficha esperando';
  return `🔎 ${n} em análise${chave === 'regional' ? ' (todas)' : ''}`;
}

function cardDivisao(m, e) {
  const regional = e.chave === 'regional';
  const fundo = `background-image:url('${regional ? IMG_REGIONAL : IMG_DIVISAO}'); background-size:cover; background-position:center;`;
  const texto = contagemDoCard(m, e.chave);
  return `
    <div class="card event-card ${regional ? 'card-regional-home' : 'card-divisao-home'} mesa-card" style="${fundo}" data-mesa="escolher" data-value="${e.chave}">
      ${regional
        ? `${texto ? `<div class="event-date-badge">${escapeHtml(texto)}</div>` : ''}<div></div>`
        : `<div><div class="name">${escapeHtml(e.nome)}</div>${texto ? `<div class="meta">${escapeHtml(texto)}</div>` : ''}</div>`}
      <div class="arrow">›</div>
    </div>`;
}

function telaCards(m) {
  return `
    ${cabecalho('Regional RJ4')}
    ${m.contagemErro ? '<div class="pret-explica mesa-aviso">Não deu pra contar as fichas agora - os cards abrem do mesmo jeito.</div>' : ''}
    ${escoposNaOrdemOficial().map(e => cardDivisao(m, e)).join('')}
    ${rodape}`;
}

// ---------- o PIN ----------

function telaPin(m) {
  return `
    <div class="back-link on-photo" data-mesa="cards">‹ Divisões</div>
    ${cabecalho(nomeDivisaoAdmissao(m.escopo))}
    <div class="card">
      <label for="mesa-pin">PIN da divisão</label>
      <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" class="pin-input" id="mesa-pin" placeholder="••••" ${m.pinVerificando ? 'disabled' : ''}>
      ${m.pinErro ? `<div class="mesa-erro">${escapeHtml(m.pinErro)}</div>` : ''}
      <button class="btn block" data-mesa="entrar" ${m.pinVerificando ? 'disabled' : ''}>${m.pinVerificando ? 'Verificando…' : 'Entrar'}</button>
      <div class="pret-explica" style="margin-top:10px;">O mesmo PIN do Modo organizador da divisão.</div>
    </div>
    ${rodape}`;
}

// ---------- a lista ----------

function selo(p) {
  const s = situacaoDe(p);
  return `<span class="pret-situacao analise">${s.emoji} ${escapeHtml(s.rotulo)}</span>`;
}

function linha(p) {
  return `
    <div class="card event-card pret-linha mesa-linha" data-mesa="abrir" data-id="${escapeHtml(p.id)}">
      <div class="pret-linha-texto">
        <div class="name">${escapeHtml(p.nomeColete || '(sem nome)')}</div>
        <div class="meta">${escapeHtml(p.nomeCompleto || '')}${p.enviadoEm ? ` · ${escapeHtml(p.enviadoEm.slice(0, 10))}` : ''}</div>
        <div class="mesa-linha-selo">${selo(p)}</div>
      </div>
      <button class="btn mesa-aprovar-linha" data-mesa="aprovar-linha" data-id="${escapeHtml(p.id)}">✅ Aprovar</button>
    </div>`;
}

function blocoDaDivisao(chave, daqui) {
  return `
    <div class="pret-bloco">
      <div class="pret-bloco-titulo">${escapeHtml(nomeDivisaoAdmissao(chave))}${daqui.length ? ` <span>(${daqui.length})</span>` : ''}</div>
      ${daqui.length ? daqui.map(linha).join('') : '<div class="pret-vazio">— nenhuma ficha</div>'}
    </div>`;
}

function topoDaDivisao(m, voltar) {
  return `
    <div class="mesa-topo">
      <div class="back-link on-photo" data-mesa="${voltar}">${voltar === 'fechar' ? '‹ Voltar à lista' : '‹ Divisões'}</div>
      <button class="btn ghost mesa-sair" data-mesa="sair">🚪 Sair</button>
    </div>`;
}

function telaLista(m) {
  const topo = `${topoDaDivisao(m, 'sair')}${cabecalho(nomeDivisaoAdmissao(m.escopo))}`;
  if (m.carregando && !m.dados) return `${topo}<div class="loading">Buscando as fichas…</div>${rodape}`;
  if (m.erro) {
    return `${topo}
      <div class="alert"><div class="alert-msg">Não deu pra buscar as fichas: ${escapeHtml(m.erro)}.</div>
      <button class="btn secondary block" data-mesa="recarregar" style="margin-top:10px;">Tentar de novo</button></div>${rodape}`;
  }
  const fichas = pretendentesDaMesa(m.dados, m.escopo);
  const resumo = `<div class="pret-resumo">🔎 ${fichas.length} ${fichas.length === 1 ? 'ficha em análise' : 'fichas em análise'} · toque no nome pra ver os dados</div>`;
  let corpo;
  if (m.escopo === 'regional') {
    corpo = escoposNaOrdemOficial().map(e => blocoDaDivisao(e.chave, fichas.filter(p => p.divisao === e.chave))).join('');
  } else {
    corpo = fichas.length ? fichas.map(linha).join('') : '<div class="empty">Nenhuma ficha esperando. ✅</div>';
  }
  return `${topo}${resumo}${corpo}
    <button class="btn secondary block" data-mesa="recarregar" style="margin-top:6px;" ${m.carregando ? 'disabled' : ''}>${m.carregando ? 'Buscando…' : '🔄 Atualizar'}</button>
    ${rodape}`;
}

// ---------- a ficha de um ----------

// A confirmacao do Aprovar e do Desistiu, dizendo antes o que vai acontecer.
function painelConfirmar(m, p) {
  const conf = m.confirmar;
  const nome = escapeHtml(p.nomeColete || '(sem nome)');
  const travado = m.salvando ? 'disabled' : '';
  if (conf.tipo === 'desistiu') {
    return `
      <div class="pret-confirmar perigo">
        <div class="pret-confirmar-titulo">❌ ${nome} desistiu?</div>
        <div class="pret-explica">A ficha inteira é apagada, com CPF, RG e endereço. Não dá pra desfazer: se ele voltar, preenche o link da ficha de novo.</div>
        <div class="row-gap">
          <button class="btn danger" style="flex:1;" data-mesa="desistiu" data-id="${escapeHtml(p.id)}" ${travado}>${m.salvando ? 'Apagando…' : '❌ Apagar a ficha'}</button>
          <button class="btn secondary" style="flex:1;" data-mesa="cancelar" ${travado}>Cancelar</button>
        </div>
      </div>`;
  }
  const doRegional = p.divisao === 'regional';
  const destino = doRegional ? conf.destino : p.divisao;
  const iguais = irmaosComMesmoNome(m.roster, p.nomeColete);
  return `
    <div class="pret-confirmar">
      <div class="pret-confirmar-titulo">✅ Aprovar ${nome}?</div>
      ${doRegional ? `
        <div class="field">
          <label>A ficha veio pelo link do Regional. Em qual divisão ele entra?</label>
          <div class="acao-escolha">
            ${escoposNaOrdemOficial().filter(e => e.chave !== 'regional').map(e => `
              <button class="acao-escolha-opcao ${conf.destino === e.chave ? 'ativo' : ''}" data-mesa="destino" data-value="${e.chave}">${escapeHtml(nomeCurto(e.chave))}</button>`).join('')}
          </div>
        </div>` : ''}
      <ul class="pret-confirmar-lista">
        <li>Entra no app, em <b>Membros${destino ? ` da ${escapeHtml(nomeDivisaoAdmissao(destino))}` : ''}</b>, como <b>${nome}</b>, grau <b>X</b>, com data de ingresso <b>hoje (${formatDataBR(hojeISO())})</b>.</li>
        <li>A carteirinha dele já nasce com os dados da ficha.</li>
        <li>A ficha sai desta lista e fica guardada na carteirinha dele, no app.</li>
      </ul>
      ${iguais.length ? `
        <div class="alert" style="margin:8px 0;"><div class="alert-msg">⚠️ Já existe ${iguais.length === 1 ? 'um irmão' : 'irmãos'} com esse nome: ${iguais.map(x => `<b>${escapeHtml(x.nome)}</b> (${escapeHtml(x.divisao || '')})`).join(', ')}. Se for outra pessoa, aprove e o ADM troca o nome depois no app.</div></div>` : ''}
      <div class="row-gap">
        <button class="btn" style="flex:1;" data-mesa="aprovar" data-id="${escapeHtml(p.id)}" ${m.salvando || !destino ? 'disabled' : ''}>${m.salvando ? 'Cadastrando…' : '✅ Confirmar aprovação'}</button>
        <button class="btn secondary" style="flex:1;" data-mesa="cancelar" ${travado}>Cancelar</button>
      </div>
    </div>`;
}

function telaFicha(m, p) {
  const celular = soDigitos(p.celular);
  return `
    ${topoDaDivisao(m, 'fechar')}
    <div class="card pret-cabeca">
      <div class="pret-cabeca-topo">
        <div>
          <div class="pret-nome">${escapeHtml(p.nomeColete || '(sem nome)')}</div>
          <div class="pret-nome-completo">${escapeHtml(p.nomeCompleto || '')}</div>
        </div>
        ${selo(p)}
      </div>
      <div class="pret-meta">${escapeHtml(nomeDivisaoAdmissao(p.divisao))}${p.enviadoEm ? ` · enviada em ${escapeHtml(p.enviadoEm)}` : ''}</div>
      ${celular ? `
        <div class="row-gap" style="margin-top:12px;">
          <a class="btn secondary" style="flex:1;" href="tel:${celular}">📞 Ligar</a>
          <a class="btn secondary" style="flex:1;" href="https://wa.me/55${celular}" target="_blank" rel="noopener">💬 WhatsApp</a>
        </div>` : ''}
      <div class="pret-situacao-acao">
        ${m.confirmar ? painelConfirmar(m, p) : `
          <div class="row-gap">
            <button class="btn" style="flex:1;" data-mesa="confirmar" data-value="aprovar">✅ Aprovar</button>
            <button class="btn danger" style="flex:1;" data-mesa="confirmar" data-value="desistiu">❌ Desistiu</button>
          </div>`}
      </div>
      <div class="row-gap" style="margin-top:12px;">
        <button class="btn secondary" style="flex:1;" data-mesa="copiar-tudo">📋 Copiar ficha inteira</button>
        <button class="btn secondary" style="flex:1;" data-mesa="pdf">📄 PDF</button>
      </div>
      <div class="pret-explica" style="margin-top:10px;">Toque no 📋 de um dado pra copiar só ele e colar no sistema do clube.</div>
    </div>
    ${partesDoPretendente(p).map(parte => `
      <div class="card pret-parte">
        <div class="ficha-parte-titulo">${escapeHtml(parte.titulo)}</div>
        ${parte.linhas.map(l => `
          <div class="pret-dado mesa-dado">
            <div class="pret-dado-rotulo">${escapeHtml(l.rotulo)}</div>
            <div class="pret-dado-valor">${escapeHtml(l.valor || '-')}</div>
            ${l.valor ? `<button class="mesa-copiar" data-mesa="copiar" data-campo="${l.campo.chave}" aria-label="Copiar ${escapeHtml(l.rotulo)}">📋</button>` : ''}
          </div>`).join('')}
      </div>`).join('')}
    ${rodape}`;
}

// ---------- a pagina ----------

export function htmlMesa(m) {
  if (m.tela === 'pin') return telaPin(m);
  if (m.tela === 'lista') return telaLista(m);
  if (m.tela === 'ficha') {
    const p = (m.dados || []).find(x => x.id === m.aberto);
    return p ? telaFicha(m, p) : telaLista(m);
  }
  return telaCards(m);
}
