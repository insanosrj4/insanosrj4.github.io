// O link Atualizar-cadastro (27/11/2026): o irmao abre
// insanosrj4.github.io/Atualizar-cadastro, acha o proprio nome e completa o
// que falta na carteirinha dele - em vez do ADM pedir um por um e redigitar.
// Aqui os campos, a conferencia antes de enviar e o que vai pra planilha; a
// pagina (cadastro.html) e o card do organizador leem daqui.
//
// O formulario so pergunta o que esta VAZIO: a planilha diz quais campos
// faltam (cadastroLista, no Code.gs), nunca o valor dos que ja estao la. E
// so grava campo vazio - corrigir o que ja existe e com o organizador.
// O Code.gs confere tudo de novo (completarCadastroPeloLink): o link e
// publico, e a conferencia daqui so poupa uma ida a planilha a toa.

import { SIM_NAO, TIPOS_SANGUE, campoVisivel, telefoneValido } from './admissao.js';

export const CAMINHO_CADASTRO = 'Atualizar-cadastro';

// O link da pagina. `base` e o endereco da raiz do site (o document.baseURI
// do app), como o linkDaMesa.
export function linkDoCadastro(base) {
  try { return new URL(CAMINHO_CADASTRO, base).href; } catch (e) { return CAMINHO_CADASTRO; }
}

// O que pode faltar na carteirinha, na ordem do Code.gs (CAMPOS_CADASTRO), e
// o nome de cada um na tela. "entrada" e a data de ingresso, que mora no
// cadastro de Membros e nao na carteirinha.
export const DADOS_DO_CADASTRO = [
  { chave: 'nomeCompleto', rotulo: 'Nome completo', emoji: '👤' },
  { chave: 'telefone', rotulo: 'Telefone', emoji: '📞' },
  { chave: 'nascimento', rotulo: 'Nascimento', emoji: '🎂' },
  { chave: 'entrada', rotulo: 'Data de entrada no clube', emoji: '🗓️' },
  { chave: 'emergenciaNome', rotulo: 'Contato de emergência', emoji: '🆘' },
  { chave: 'emergenciaParentesco', rotulo: 'Parentesco do contato', emoji: '🆘' },
  { chave: 'emergenciaTelefone', rotulo: 'Telefone de emergência', emoji: '🆘' },
  { chave: 'tipoSanguineo', rotulo: 'Tipo sanguíneo', emoji: '🩸' },
  { chave: 'planoSaude', rotulo: 'Plano de saúde', emoji: '🏥' },
  { chave: 'saude', rotulo: 'Alergias e condições', emoji: '⚕️' },
];

// O formulario, em 3 partes. Cada campo tem o `de`: o dado da carteirinha
// que ele completa - o campo so aparece se aquele dado falta. Plano de
// saude, alergia e condicao sao perguntados como na ficha do pretendente
// (Sim/Nao, e o "Qual?" so no Sim); a planilha junta alergia e condicao no
// campo unico da carteirinha. Tudo o que aparece e obrigatorio.
export const PARTES_CADASTRO = [
  { titulo: 'Seus dados', campos: [
    { chave: 'nomeCompleto', de: 'nomeCompleto', rotulo: 'Nome completo', tipo: 'texto', max: 120, auto: 'name' },
    { chave: 'telefone', de: 'telefone', rotulo: 'Celular / WhatsApp', tipo: 'telefone', auto: 'tel' },
    { chave: 'nascimento', de: 'nascimento', rotulo: 'Data de nascimento', tipo: 'data', auto: 'bday' },
    { chave: 'entrada', de: 'entrada', rotulo: 'Data de entrada no clube', tipo: 'data',
      ajuda: 'O dia em que você entrou no Insanos.' },
  ] },
  { titulo: 'Contato de emergência', campos: [
    { chave: 'emergenciaNome', de: 'emergenciaNome', rotulo: 'Nome do contato', tipo: 'texto', max: 80 },
    { chave: 'emergenciaParentesco', de: 'emergenciaParentesco', rotulo: 'Grau de parentesco', tipo: 'texto', max: 40, dica: 'Ex.: esposa, mãe, irmão' },
    { chave: 'emergenciaTelefone', de: 'emergenciaTelefone', rotulo: 'Telefone do contato', tipo: 'telefone' },
  ] },
  { titulo: 'Saúde', campos: [
    { chave: 'tipoSanguineo', de: 'tipoSanguineo', rotulo: 'Tipo sanguíneo', tipo: 'escolha', opcoes: TIPOS_SANGUE },
    { chave: 'convenio', de: 'planoSaude', rotulo: 'Tem plano de saúde?', tipo: 'escolha', opcoes: SIM_NAO },
    { chave: 'convenioQual', de: 'planoSaude', rotulo: 'Qual plano?', tipo: 'texto', soSe: ['convenio', 'Sim'], max: 80, dica: 'Ex.: Unimed, Amil, Bradesco Saúde' },
    { chave: 'alergia', de: 'saude', rotulo: 'Tem alguma alergia?', tipo: 'escolha', opcoes: SIM_NAO },
    { chave: 'alergiaQual', de: 'saude', rotulo: 'Qual alergia?', tipo: 'texto', soSe: ['alergia', 'Sim'], max: 150, dica: 'Ex.: dipirona, camarão, picada de abelha' },
    { chave: 'condicao', de: 'saude', rotulo: 'Tem alguma condição de saúde?', tipo: 'escolha', opcoes: SIM_NAO,
      ajuda: 'Algo que quem estiver junto precisa saber numa emergência.' },
    { chave: 'condicaoQual', de: 'saude', rotulo: 'Qual condição?', tipo: 'texto', soSe: ['condicao', 'Sim'], max: 150, dica: 'Ex.: diabetes, pressão alta, epilepsia' },
  ] },
];

export const CAMPOS_CADASTRO = PARTES_CADASTRO.flatMap(p => p.campos);

// As partes com so os campos do que falta (parte sem nada some).
export function partesQueFaltam(falta) {
  const f = falta || [];
  return PARTES_CADASTRO
    .map(p => ({ titulo: p.titulo, campos: p.campos.filter(c => f.includes(c.de)) }))
    .filter(p => p.campos.length);
}

// O que ja esta na carteirinha: so o NOME do dado, pra dizer "✅ já
// informado" - o valor a pagina nunca recebe.
export const jaInformados = (falta) => DADOS_DO_CADASTRO.filter(d => !(falta || []).includes(d.chave));
export const cadastroCompleto = (m) => !!m && !(m.falta || []).length;

// Quantos da lista ja estao completos (os cards das divisoes).
export function resumoDoCadastro(membros) {
  const lista = membros || [];
  return { total: lista.length, completos: lista.filter(cadastroCompleto).length };
}

// Confere o formulario. `valores` vem com as datas ja em ISO (ou o texto
// como foi digitado, se nao virou data) e `hoje` em ISO. Devolve a lista de
// problemas, cada um com o campo e a frase - vazia, pode enviar.
export function conferirCadastro(valores, falta, hoje) {
  const erros = [];
  const erro = (campo, msg) => erros.push({ chave: campo.chave, msg });
  CAMPOS_CADASTRO.forEach(campo => {
    if (!(falta || []).includes(campo.de) || !campoVisivel(campo, valores)) return;
    const v = String(valores[campo.chave] == null ? '' : valores[campo.chave]).trim();
    if (!v) { erro(campo, campo.tipo === 'escolha' ? `Escolha: ${campo.rotulo}` : `Preencha: ${campo.rotulo}`); return; }
    if (campo.tipo === 'escolha' && !campo.opcoes.includes(v)) erro(campo, `Escolha: ${campo.rotulo}`);
    if (campo.tipo === 'telefone' && !telefoneValido(v)) erro(campo, `${campo.rotulo}: coloque o DDD e o número.`);
    if (campo.tipo === 'data') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) erro(campo, `${campo.rotulo}: escreva dia/mês/ano, como 21/09/1990.`);
      else if (campo.chave === 'nascimento' && (v > hoje || v < '1920-01-01')) erro(campo, 'Data de nascimento inválida.');
      else if (campo.chave === 'entrada' && v > hoje) erro(campo, 'A data de entrada não pode ser no futuro.');
      else if (campo.chave === 'entrada' && v < '1950-01-01') erro(campo, 'Data de entrada inválida.');
    }
  });
  return erros;
}

// O que vai pra planilha: so os campos do que falta e que estao a vista,
// sem espaco sobrando. Campo escondido vai vazio (marcou Sim, escreveu o
// plano e voltou pro Nao: o nome do plano nao vale).
export function cadastroParaEnvio(valores, falta) {
  const saida = {};
  CAMPOS_CADASTRO.forEach(campo => {
    if (!(falta || []).includes(campo.de)) return;
    saida[campo.chave] = campoVisivel(campo, valores)
      ? String(valores[campo.chave] == null ? '' : valores[campo.chave]).trim().replace(/\s+/g, ' ') : '';
  });
  return saida;
}
