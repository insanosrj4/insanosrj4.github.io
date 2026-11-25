// Gera as paginas dos enderecos limpos (25/11/2026, site insanosrj4.github.io):
//
//   App/index.html                        <- index.html  (o app)
//   Ficha-pretendentes/<Divisao>/index.html <- ficha.html (uma por divisao)
//   Controle-pretendentes/index.html      <- mesa.html   (a pagina da Mesa)
//   404.html                              <- o endereco em minuscula, sem
//                                            acento ou com barra no fim cai
//                                            no lugar certo
//
// Cada copia e a pagina original com <base href="/"> logo no <head>: assim
// css/, js/ e img/ sao achados na raiz do site, de dentro de qualquer pasta.
// A divisao da ficha sai do nome da pasta (divisaoDaPasta, em ficha.js).
//
// Rodar depois de mexer em index.html, ficha.html ou mesa.html:
//     node ferramentas/paginas.mjs
// O regras.mjs confere que as copias estao em dia com as originais.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const SITE = 'https://insanosrj4.github.io';

const A = await import(pathToFileURL(path.join(RAIZ, 'js', 'dominio', 'admissao.js')).href);
const C = await import(pathToFileURL(path.join(RAIZ, 'js', 'nucleo', 'config.js')).href);

const ler = (nome) => fs.readFileSync(path.join(RAIZ, nome), 'utf8').replace(/\r\n/g, '\n');

// A copia: <base href="/"> logo depois do <head>, o aviso de que e gerada e
// o og:url do endereco novo (a previa do WhatsApp).
function copia(original, nomeOriginal, caminho) {
  let html = ler(original).replace('<head>\n', `<head>\n<base href="/">\n<!-- Gerada por ferramentas/paginas.mjs a partir de ${nomeOriginal} - nao editar aqui. -->\n`);
  const url = `${SITE}/${caminho}`;
  if (/<meta property="og:url"[^>]*>/.test(html)) html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}">`);
  else html = html.replace('<meta property="og:type"', `<meta property="og:url" content="${url}">\n<meta property="og:type"`);
  return html;
}

// O 404 do GitHub Pages: qualquer endereco que nao existe cai aqui. Ele tira
// acento, maiuscula e a barra do fim e, se for um dos enderecos limpos, manda
// pro certo (com o ?... e o #... de antes). Senao, diz que nao achou.
function pagina404() {
  const rotas = { [`/${A.CAMINHO_APP.toLowerCase()}`]: `/${A.CAMINHO_APP}/`, [`/${A.CAMINHO_MESA.toLowerCase()}`]: `/${A.CAMINHO_MESA}/` };
  C.escoposNaOrdemOficial().forEach(e => {
    const pasta = A.pastaDaDivisao(e.chave);
    rotas[`/${A.CAMINHO_FICHAS.toLowerCase()}/${pasta.toLowerCase()}`] = `/${A.CAMINHO_FICHAS}/${pasta}/`;
  });
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<!-- Gerada por ferramentas/paginas.mjs - nao editar aqui. -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Insanos MC · Regional RJ4</title>
<script>
(function () {
  var rotas = ${JSON.stringify(rotas)};
  var p = location.pathname;
  try { p = decodeURIComponent(p); } catch (e) {}
  p = p.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\/+$/, '');
  var destino = rotas[p];
  if (destino) location.replace(destino + location.search + location.hash);
})();
</script>
<link href="https://fonts.googleapis.com/css2?family=Rye&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/estilo.css">
</head>
<body>
<div id="app">
  <div class="crest-wrap">
    <img src="/img/logo.webp" alt="Insanos MC">
    <h1>Página não encontrada</h1>
    <div class="sub">Confira o link que você recebeu.</div>
  </div>
  <div class="card"><a class="btn block" href="/${A.CAMINHO_APP}/">Abrir o app</a></div>
</div>
</body>
</html>
`;
}

// O endereco antigo (vini04rock.github.io/Presenca-RJ4/...): depois da mudanca
// pra organizacao insanosrj4, um repositorio pequeno no lugar do antigo so com
// isto (index.html, ficha.html, mesa.html e 404.html iguais), que manda cada
// link velho pro novo:
//   /Presenca-RJ4/                       -> /App
//   /Presenca-RJ4/ficha.html?divisao=X   -> /Ficha-pretendentes/X
//   /Presenca-RJ4/mesa.html              -> /Controle-pretendentes
// Fica em ferramentas/link-antigo/ (nao e servido pelo site novo).
function paginaLinkAntigo() {
  const pastas = {};
  C.escoposNaOrdemOficial().forEach(e => { pastas[e.chave] = A.pastaDaDivisao(e.chave); });
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<!-- Gerada por ferramentas/paginas.mjs - o endereco antigo, que manda pro novo. -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Insanos MC · Regional RJ4 - endereço novo</title>
<script>
(function () {
  var site = '${SITE}';
  var pastas = ${JSON.stringify(pastas)};
  var p = location.pathname.toLowerCase();
  var q = new URLSearchParams(location.search);
  var destino = '/${A.CAMINHO_APP}';
  if (/ficha\\.html$/.test(p) && pastas[q.get('divisao')]) destino = '/${A.CAMINHO_FICHAS}/' + pastas[q.get('divisao')];
  else if (/mesa\\.html$/.test(p)) destino = '/${A.CAMINHO_MESA}';
  location.replace(site + destino);
})();
</script>
</head>
<body style="background:#111;color:#eee;font-family:sans-serif;text-align:center;padding:40px 16px;">
<p>O app do Insanos MC Regional RJ4 mudou de endereço.</p>
<p><a style="color:#D4A24C;" href="${SITE}/${A.CAMINHO_APP}">${SITE.replace('https://', '')}/${A.CAMINHO_APP}</a></p>
</body>
</html>
`;
}

export function gerarPaginas() {
  const paginas = [
    { caminho: `${A.CAMINHO_APP}/index.html`, conteudo: copia('index.html', 'index.html', A.CAMINHO_APP) },
    { caminho: `${A.CAMINHO_MESA}/index.html`, conteudo: copia('mesa.html', 'mesa.html', A.CAMINHO_MESA) },
  ];
  C.escoposNaOrdemOficial().forEach(e => {
    const pasta = `${A.CAMINHO_FICHAS}/${A.pastaDaDivisao(e.chave)}`;
    paginas.push({ caminho: `${pasta}/index.html`, conteudo: copia('ficha.html', 'ficha.html', pasta) });
  });
  paginas.push({ caminho: '404.html', conteudo: pagina404() });
  const antigo = paginaLinkAntigo();
  paginas.push({ caminho: 'ferramentas/link-antigo/index.html', conteudo: antigo });
  paginas.push({ caminho: 'ferramentas/link-antigo/404.html', conteudo: antigo });
  paginas.push({ caminho: 'ferramentas/link-antigo/ficha.html', conteudo: antigo });
  paginas.push({ caminho: 'ferramentas/link-antigo/mesa.html', conteudo: antigo });
  return paginas;
}

// As que estao diferentes do que o gerador faria (ou faltando).
export function paginasDesatualizadas() {
  return gerarPaginas().filter(p => {
    const arq = path.join(RAIZ, p.caminho);
    return !fs.existsSync(arq) || fs.readFileSync(arq, 'utf8').replace(/\r\n/g, '\n') !== p.conteudo;
  }).map(p => p.caminho);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const p of gerarPaginas()) {
    const arq = path.join(RAIZ, p.caminho);
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, p.conteudo, 'utf8');
    console.log('gerada', p.caminho);
  }
}
