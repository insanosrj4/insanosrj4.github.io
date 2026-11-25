// O card 📝 Pretendentes (14/11/2026), na area ADM das 7 divisoes: as fichas
// de admissao que chegaram pelo link de cada divisao (ficha.html). Cada
// divisao ve as do link dela; o Regional ve todas, em blocos por divisao.
//
// Aqui ficam o link pra mandar (e o da pagina da Mesa, mesa.html), a lista
// e a ficha de cada um, com o WhatsApp/PDF, que levam a ficha inteira pra
// passar pro sistema. Toda ficha ja chega 🔎 Em analise (o "Novo" e o botao
// de marcar sairam em 25/11/2026). Desde 25/11/2026, o
// ✅ Aprovado (cadastra o irmao em Membros, com a carteirinha preenchida, e
// guarda a ficha na carteirinha dele) e o ❌ Desistiu (apaga a ficha), os
// dois com confirmacao na propria ficha. As regras e o texto moram em
// dominio/admissao.js.

import { api } from '../nucleo/api.js';
import { escoposNaOrdemOficial } from '../nucleo/config.js';
import { state } from '../nucleo/estado.js';
import { render } from '../nucleo/render.js';
import { copiarTexto, escapeHtml, formatDataBR, hojeISO, imprimirTexto, mostrarAviso } from '../nucleo/util.js';
import { recarregarEventos } from '../dados/carregar.js';
import { ehAprovado, irmaosComMesmoNome, linkDaFicha, linkDaMesa, nomeDivisaoAdmissao, ordenarPretendentes,
  partesDoPretendente, situacaoDe, textoFichaAdmissao } from '../dominio/admissao.js';
import { botaoGerarRelatorio } from '../ui/comuns.js';

const lista = () => state.pretendentesDados || [];
const doId = (id) => lista().find(p => p.id === id) || null;
const link = (chave) => linkDaFicha(window.location.href, chave);
function seloSituacao(p) {
  const s = situacaoDe(p);
  return `<span class="pret-situacao ${ehAprovado(p) ? 'aprovado' : 'analise'}">${s.emoji} ${escapeHtml(s.rotulo)}</span>`;
}

// ---------- o link pra mandar ----------

function cardLink() {
  const regional = state.adminEscopo === 'regional';
  const linhaLink = (chave, rotulo) => `
    <div class="pret-link-linha">
      <div class="pret-link-texto">
        ${rotulo ? `<div class="pret-link-nome">${escapeHtml(rotulo)}</div>` : ''}
        <div class="pret-link-url">${escapeHtml(link(chave))}</div>
      </div>
      <button class="btn secondary pret-link-copiar" data-action="pretendente-copiar-link" data-value="${chave}">📋 Copiar</button>
    </div>`;
  return `
    <div class="card pret-links">
      <div class="painel-titulo">🔗 Link da ficha</div>
      <div class="pret-explica">${regional
        ? 'Cada divisão tem o seu link: a ficha preenchida cai direto na lista dela, e aparece aqui pro Regional.'
        : 'Mande este link pra quem quer entrar. A ficha preenchida aparece aqui embaixo.'}</div>
      ${regional
        ? escoposNaOrdemOficial().map(e => linhaLink(e.chave, nomeDivisaoAdmissao(e.chave))).join('')
        : linhaLink(state.adminEscopo, '')}
    </div>
    <div class="card pret-links">
      <div class="painel-titulo">🗂️ Link da Mesa</div>
      <div class="pret-explica">Pros integrantes de mesa verem as fichas e lançarem no sistema do clube, sem entrar no app. Cada divisão abre com o PIN dela (o mesmo do Modo organizador).</div>
      <div class="pret-link-linha">
        <div class="pret-link-texto"><div class="pret-link-url">${escapeHtml(linkDaMesa(window.location.href))}</div></div>
        <button class="btn secondary pret-link-copiar" data-action="pretendente-copiar-link" data-value="mesa">📋 Copiar</button>
      </div>
    </div>`;
}

// ---------- a lista ----------

function linhaPretendente(p, comDivisao) {
  return `
    <div class="card event-card pret-linha" data-action="abrir-pretendente" data-id="${escapeHtml(p.id)}">
      <div class="pret-linha-texto">
        <div class="name">${escapeHtml(p.nomeColete || '(sem nome)')}</div>
        <div class="meta">${escapeHtml(p.nomeCompleto || '')}${p.enviadoEm ? ` · ${escapeHtml(p.enviadoEm.slice(0, 10))}` : ''}${comDivisao ? ` · ${escapeHtml(nomeDivisaoAdmissao(p.divisao))}` : ''}</div>
      </div>
      ${seloSituacao(p)}
    </div>`;
}

function resumo(l) {
  const aprovados = l.filter(ehAprovado).length;
  const analise = l.length - aprovados;
  return `${l.length} ${l.length === 1 ? 'ficha' : 'fichas'} · 🔎 ${analise} em análise`
    + (aprovados ? ` · ✅ ${aprovados} ${aprovados === 1 ? 'aprovado' : 'aprovados'}` : '');
}

// Os aprovados ja viraram irmaos: ficam dobrados no fim, pra nao misturar
// com quem ainda pede acao. Abertos, um embaixo do outro, com a divisao.
function blocoAprovados(aprovados, comDivisao) {
  if (!aprovados.length) return '';
  const aberto = state.pretendentesAprovadosAbertos;
  return `
    <div class="pret-aprovados">
      <button class="pret-aprovados-titulo" data-action="pretendentes-aprovados">✅ ${aprovados.length} ${aprovados.length === 1 ? 'aprovado' : 'aprovados'} ${aberto ? '▾' : '▸'}</button>
      ${aberto ? `
        <div class="pret-explica">Já estão em Membros. A ficha de cada um fica guardada na carteirinha dele (📝 Ficha de cadastro).</div>
        ${aprovados.map(p => linhaPretendente(p, comDivisao)).join('')}` : ''}
    </div>`;
}

// No Regional, um bloco por divisao, com as fichas que esperam.
function blocoDivisao(chave, daqui) {
  return `
    <div class="pret-bloco">
      <div class="pret-bloco-titulo">${escapeHtml(nomeDivisaoAdmissao(chave))}${daqui.length ? ` <span>(${daqui.length})</span>` : ''}</div>
      ${daqui.length ? daqui.map(p => linhaPretendente(p)).join('') : '<div class="pret-vazio">— nenhuma ficha</div>'}
    </div>`;
}

function renderLista() {
  const todas = ordenarPretendentes(lista());
  const esperando = todas.filter(p => !ehAprovado(p));
  const aprovados = todas.filter(ehAprovado);
  if (state.adminEscopo !== 'regional') {
    if (!todas.length) {
      return `
        <div class="painel-titulo" style="margin-top:6px;">Fichas recebidas</div>
        <div class="empty">Nenhuma ficha ainda. Mande o link acima pra quem quer entrar.</div>`;
    }
    const linhas = esperando.length ? esperando.map(p => linhaPretendente(p)).join('') : '<div class="pret-vazio">— nenhuma ficha esperando</div>';
    return `
      <div class="painel-titulo" style="margin-top:6px;">Fichas recebidas</div>
      <div class="pret-resumo">${resumo(todas)}</div>
      ${linhas}
      ${blocoAprovados(aprovados, false)}`;
  }
  const blocos = escoposNaOrdemOficial().map(e => blocoDivisao(e.chave, esperando.filter(p => p.divisao === e.chave))).join('');
  return `
    <div class="painel-titulo" style="margin-top:6px;">Fichas recebidas</div>
    <div class="pret-resumo">${resumo(todas)}</div>
    ${blocos}
    ${blocoAprovados(aprovados, true)}`;
}

// ---------- a ficha de um ----------

function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }

// A ficha de quem ja foi aprovado: so o aviso de onde ele esta agora.
function caixaAprovado(p) {
  const irmao = (state.roster || []).find(m => m.id === p.membroId);
  return `
    <div class="pret-situacao-acao">
      <div class="pret-aprovado-ok">✅ Aprovado${p.atualizadoEm ? ` em ${escapeHtml(p.atualizadoEm)}` : ''}</div>
      <div class="pret-explica">${irmao
        ? `Já está em Membros: <b>${escapeHtml(irmao.nome)}</b> · grau ${escapeHtml(irmao.grau || '-')} · ${escapeHtml(irmao.divisao || '')}.`
        : 'Já está em Membros.'}
        Esta ficha fica guardada na carteirinha dele, no 📝 Ficha de cadastro (Membros › Carteirinhas).</div>
    </div>`;
}

// Os botoes da ficha que ainda nao foi aprovada: a situacao (Novo <-> Em
// analise) e, embaixo, o Aprovado e o Desistiu.
function acoesDaFicha(p) {
  const salvando = state.pretendenteSalvando ? 'disabled' : '';
  const conf = state.pretendenteConfirmar;
  return `
    <div class="pret-situacao-acao no-print">
      <div class="pret-explica">🔎 Em análise: a mesa lança os dados no sistema do clube. Quando ele entrar, toque em ✅ Aprovado.</div>
      ${conf ? painelConfirmar(p, conf) : `
        <div class="row-gap pret-decisao">
          <button class="btn" style="flex:1;" data-action="pretendente-confirmar" data-id="${escapeHtml(p.id)}" data-value="aprovar" ${salvando}>✅ Aprovado</button>
          <button class="btn danger" style="flex:1;" data-action="pretendente-confirmar" data-id="${escapeHtml(p.id)}" data-value="desistiu" ${salvando}>❌ Desistiu</button>
        </div>`}
    </div>`;
}

// A confirmacao, na propria ficha, dizendo o que vai acontecer antes.
function painelConfirmar(p, conf) {
  const salvando = state.pretendenteSalvando;
  const nome = escapeHtml(p.nomeColete || '(sem nome)');
  if (conf.tipo === 'desistiu') {
    return `
      <div class="pret-confirmar perigo">
        <div class="pret-confirmar-titulo">❌ ${nome} desistiu?</div>
        <div class="pret-explica">A ficha inteira é apagada, com CPF, RG e endereço. Não dá pra desfazer: se ele voltar, preenche o link de novo.</div>
        <div class="row-gap">
          <button class="btn danger" style="flex:1;" data-action="pretendente-desistiu" data-id="${escapeHtml(p.id)}" ${salvando ? 'disabled' : ''}>${salvando ? 'Apagando…' : '❌ Apagar a ficha'}</button>
          <button class="btn secondary" style="flex:1;" data-action="pretendente-cancelar" ${salvando ? 'disabled' : ''}>Cancelar</button>
        </div>
      </div>`;
  }
  const doRegional = p.divisao === 'regional';
  const destino = doRegional ? conf.destino : p.divisao;
  const iguais = irmaosComMesmoNome(state.roster, p.nomeColete);
  return `
    <div class="pret-confirmar">
      <div class="pret-confirmar-titulo">✅ Aprovar ${nome}?</div>
      ${doRegional ? `
        <div class="field">
          <label>A ficha veio pelo link do Regional. Em qual divisão ele entra?</label>
          <div class="acao-escolha">
            ${escoposNaOrdemOficial().filter(e => e.chave !== 'regional').map(e => `
              <button class="acao-escolha-opcao ${conf.destino === e.chave ? 'ativo' : ''}" data-action="pretendente-destino" data-value="${e.chave}">${escapeHtml(nomeDivisaoAdmissao(e.chave).replace('Divisão ', ''))}</button>`).join('')}
          </div>
        </div>` : ''}
      <ul class="pret-confirmar-lista">
        <li>Entra em <b>Membros${destino ? ` da ${escapeHtml(nomeDivisaoAdmissao(destino))}` : ''}</b> como <b>${nome}</b>, grau <b>X</b>, com data de ingresso <b>hoje (${formatDataBR(hojeISO())})</b>.</li>
        <li>A carteirinha já nasce com nome completo, celular, nascimento e contato de emergência.</li>
        <li>A ficha inteira fica guardada na carteirinha dele, no 📝 Ficha de cadastro.</li>
        <li>Eventos já abertos não recebem ele: inclua pelo Editar do evento, se quiser.</li>
      </ul>
      ${iguais.length ? `
        <div class="alert" style="margin:8px 0;"><div class="alert-msg">⚠️ Já existe ${iguais.length === 1 ? 'um irmão' : 'irmãos'} com esse nome: ${iguais.map(m => `<b>${escapeHtml(m.nome)}</b> (${escapeHtml(m.divisao || '')})`).join(', ')}. Se for outra pessoa, aprove e troque o nome depois no Cadastro.</div></div>` : ''}
      <div class="row-gap">
        <button class="btn" style="flex:1;" data-action="pretendente-aprovar" data-id="${escapeHtml(p.id)}" ${salvando || !destino ? 'disabled' : ''}>${salvando ? 'Cadastrando…' : '✅ Confirmar aprovação'}</button>
        <button class="btn secondary" style="flex:1;" data-action="pretendente-cancelar" ${salvando ? 'disabled' : ''}>Cancelar</button>
      </div>
    </div>`;
}

function renderFicha(p) {
  const celular = soDigitos(p.celular);
  return `
    <div class="back-link on-photo no-print" data-action="fechar-pretendente">‹ Voltar à lista</div>
    <div class="pc-fluxo">
    <div class="card pret-cabeca">
      <div class="pret-cabeca-topo">
        <div>
          <div class="pret-nome">${escapeHtml(p.nomeColete || '(sem nome)')}</div>
          <div class="pret-nome-completo">${escapeHtml(p.nomeCompleto || '')}</div>
        </div>
        ${seloSituacao(p)}
      </div>
      <div class="pret-meta">${escapeHtml(nomeDivisaoAdmissao(p.divisao))}${p.enviadoEm ? ` · enviada em ${escapeHtml(p.enviadoEm)}` : ''}</div>
      ${celular ? `
        <div class="row-gap no-print" style="margin-top:12px;">
          <a class="btn secondary" style="flex:1;" href="tel:${celular}">📞 Ligar</a>
          <a class="btn secondary" style="flex:1;" href="https://wa.me/55${celular}" target="_blank" rel="noopener">💬 WhatsApp</a>
        </div>` : ''}
      ${ehAprovado(p) ? caixaAprovado(p) : acoesDaFicha(p)}
      ${botaoGerarRelatorio(`pretendente-${p.id}`, [
        { acao: 'pretendente-whatsapp', rotulo: '📋 WhatsApp', id: p.id },
        { acao: 'pretendente-pdf', rotulo: '📄 PDF', id: p.id },
      ])}
    </div>
    ${partesDoPretendente(p).map(parte => `
      <div class="card pret-parte">
        <div class="ficha-parte-titulo">${escapeHtml(parte.titulo)}</div>
        ${parte.linhas.map(l => `
          <div class="pret-dado">
            <div class="pret-dado-rotulo">${escapeHtml(l.rotulo)}</div>
            <div class="pret-dado-valor">${escapeHtml(l.valor || '-')}</div>
          </div>`).join('')}
      </div>`).join('')}
    </div>`;
}

// ---------- a aba ----------

export function renderAdminPretendentes() {
  if (state.pretendentesCarregando && !state.pretendentesDados) return '<div class="loading">Buscando as fichas…</div>';
  if (state.pretendentesErro) return `${cardLink()}<div class="alert"><div class="alert-msg">Não deu pra buscar as fichas: ${escapeHtml(state.pretendentesErro)}.</div></div>`;
  const aberto = state.pretendenteAberto && doId(state.pretendenteAberto);
  if (aberto) return renderFicha(aberto);
  // No PC (layout largo): os links de um lado, as fichas do outro.
  return `<div class="pc-colunas"><div>${cardLink()}</div><div>${renderLista()}</div></div>`;
}

const agoraBR = () => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

export const acoes = {
  'pretendente-copiar-link': async (id, target, action, e) => {
    const valor = target.dataset.value;
    await copiarTexto(valor === 'mesa' ? linkDaMesa(window.location.href) : link(valor));
  },
  'abrir-pretendente': async (id, target, action, e) => {
    state.pretendenteAberto = id;
    state.pretendenteConfirmar = null;
    state.gerarRelatorioAberto = null;
    render();
    window.scrollTo(0, 0);
  },
  'fechar-pretendente': async (id, target, action, e) => {
    state.pretendenteAberto = null;
    state.pretendenteConfirmar = null;
    return render();
  },
  'pretendentes-aprovados': async (id, target, action, e) => {
    state.pretendentesAprovadosAbertos = !state.pretendentesAprovadosAbertos;
    return render();
  },
  // Abre a confirmacao do Aprovado ou do Desistiu; tocar de novo fecha.
  'pretendente-confirmar': async (id, target, action, e) => {
    const tipo = target.dataset.value;
    state.pretendenteConfirmar = state.pretendenteConfirmar && state.pretendenteConfirmar.tipo === tipo ? null : { tipo, destino: null };
    return render();
  },
  'pretendente-cancelar': async (id, target, action, e) => {
    state.pretendenteConfirmar = null;
    return render();
  },
  'pretendente-destino': async (id, target, action, e) => {
    if (state.pretendenteConfirmar) state.pretendenteConfirmar.destino = target.dataset.value;
    return render();
  },
  'pretendente-aprovar': async (id, target, action, e) => {
    const p = doId(id);
    const conf = state.pretendenteConfirmar;
    if (!p || !conf || state.pretendenteSalvando) return;
    const destino = p.divisao === 'regional' ? conf.destino : p.divisao;
    if (!destino) return;
    state.pretendenteSalvando = true;
    render();
    try {
      const r = await api('pretendenteAprovar', { id, destino });
      p.situacao = 'Aprovado';
      p.membroId = r.membroId;
      p.atualizadoEm = agoraBR();
      state.pretendenteConfirmar = null;
      // O livro de Entrada/Saida ganhou a entrada dele: le de novo quando abrir.
      state.movimentosDados = null;
      mostrarAviso(`✅ ${p.nomeColete} entrou na ${nomeDivisaoAdmissao(r.divisao || destino)}`);
      // O cadastro novo aparece em Membros sem tirar a tela do lugar.
      recarregarEventos();
    } catch (err) {
      // O balao do api() ja explica o erro.
    }
    state.pretendenteSalvando = false;
    render();
  },
  'pretendente-desistiu': async (id, target, action, e) => {
    const p = doId(id);
    if (!p || state.pretendenteSalvando) return;
    state.pretendenteSalvando = true;
    render();
    try {
      await api('pretendenteRemover', { id });
      state.pretendentesDados = lista().filter(x => x.id !== id);
      state.pretendenteAberto = null;
      state.pretendenteConfirmar = null;
      mostrarAviso(`❌ Ficha de ${p.nomeColete || 'pretendente'} apagada`);
    } catch (err) {
      // O balao do api() ja explica o erro.
    }
    state.pretendenteSalvando = false;
    render();
  },
  'pretendente-whatsapp': async (id, target, action, e) => {
    const p = doId(id);
    if (p) await copiarTexto(textoFichaAdmissao(p));
  },
  'pretendente-pdf': async (id, target, action, e) => {
    const p = doId(id);
    if (p) imprimirTexto(textoFichaAdmissao(p));
  },
};
