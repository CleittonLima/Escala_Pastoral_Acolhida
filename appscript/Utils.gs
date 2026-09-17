/**
 * Utils.gs
 * Funções utilitárias compartilhadas por todo o backend: acesso a abas,
 * geração de IDs, conversão linha<->objeto e resposta JSON padronizada.
 */

/**
 * Retorna a aba pelo nome, criando-a (com cabeçalhos) se ainda não existir.
 * Se a aba já existir mas a versão do sistema tiver ganhado colunas novas
 * desde que ela foi criada (ex.: "apelido", "minutosChegada"), completa os
 * cabeçalhos que estiverem faltando no fim da linha 1 — sem apagar nada
 * que já existe. Isso permite atualizar o código sem precisar recriar a
 * planilha manualmente.
 */
function obterAba(nomeAba) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(nomeAba);
  const cabecalhosEsperados = CABECALHOS_ABAS[nomeAba];

  if (!aba) {
    aba = planilha.insertSheet(nomeAba);
    if (cabecalhosEsperados) {
      aba.getRange(1, 1, 1, cabecalhosEsperados.length).setValues([cabecalhosEsperados]);
      aba.setFrozenRows(1);
    }
    return aba;
  }

  if (cabecalhosEsperados && aba.getLastRow() >= 1) {
    const cabecalhosAtuais = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0];
    const faltando = cabecalhosEsperados.filter((c) => cabecalhosAtuais.indexOf(c) === -1);
    if (faltando.length > 0) {
      aba.getRange(1, cabecalhosAtuais.length + 1, 1, faltando.length).setValues([faltando]);
    }
  }
  return aba;
}

/** Gera um ID único simples baseado em timestamp + aleatório. */
function gerarId(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/** Converte todas as linhas de uma aba (exceto cabeçalho) em array de objetos. */
function lerTodasAsLinhas(nomeAba) {
  const aba = obterAba(nomeAba);
  const valores = aba.getDataRange().getValues();
  if (valores.length < 2) return [];

  const cabecalhos = valores[0];
  const linhas = valores.slice(1);

  return linhas
    .filter((linha) => linha.some((celula) => celula !== "" && celula !== null))
    .map((linha) => {
      const objeto = {};
      cabecalhos.forEach((cabecalho, indice) => {
        objeto[cabecalho] = _normalizarValor(linha[indice]);
      });
      return objeto;
    });
}

function _normalizarValor(valor) {
  if (valor instanceof Date) {
    // Datas viram string "AAAA-MM-DD" para simplificar o front-end.
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return valor;
}

/**
 * Lê a linha 1 (cabeçalhos) diretamente da planilha, na ORDEM FÍSICA REAL
 * das colunas — nunca assume que bate com a ordem de CABECALHOS_ABAS no
 * código. É isso que permite adicionar colunas novas ao código (em
 * qualquer posição) sem corromper planilhas que já existiam antes delas.
 */
function _cabecalhosReaisDaAba(aba) {
  const largura = Math.max(aba.getLastColumn(), 1);
  return aba.getRange(1, 1, 1, largura).getValues()[0];
}

/** Adiciona uma nova linha a uma aba a partir de um objeto, por NOME de coluna. */
function inserirLinha(nomeAba, objeto) {
  const aba = obterAba(nomeAba);
  const cabecalhosReais = _cabecalhosReaisDaAba(aba);
  const linha = cabecalhosReais.map((campo) => (objeto[campo] !== undefined ? objeto[campo] : ""));
  aba.appendRow(linha);
  return objeto;
}

/** Atualiza a primeira linha cuja coluna "id" bata com objeto.id. Retorna true se encontrou. */
function atualizarLinhaPorId(nomeAba, objeto) {
  const aba = obterAba(nomeAba);
  const cabecalhosReais = _cabecalhosReaisDaAba(aba);
  const indiceColunaId = cabecalhosReais.indexOf("id");
  const valores = aba.getDataRange().getValues();

  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][indiceColunaId]) === String(objeto.id)) {
      const novaLinha = cabecalhosReais.map((campo, idx) =>
        objeto[campo] !== undefined ? objeto[campo] : valores[i][idx]
      );
      aba.getRange(i + 1, 1, 1, novaLinha.length).setValues([novaLinha]);
      return true;
    }
  }
  return false;
}

/** Remove a primeira linha cuja coluna "id" bata com o id informado. */
function removerLinhaPorId(nomeAba, id) {
  const aba = obterAba(nomeAba);
  const cabecalhosReais = _cabecalhosReaisDaAba(aba);
  const indiceColunaId = cabecalhosReais.indexOf("id");
  const valores = aba.getDataRange().getValues();

  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][indiceColunaId]) === String(id)) {
      aba.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/** Monta a resposta JSON padrão devolvida a todas as chamadas da API. */
function respostaJson(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function respostaSucesso(dados) {
  return respostaJson({ sucesso: true, dados });
}

function respostaErro(mensagem) {
  return respostaJson({ sucesso: false, erro: mensagem });
}

/** Hash simples (SHA-256) para não guardar a senha do admin em texto puro. */
function hashSenha(senha) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, senha);
  return bytes.map((b) => ((b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))).join("");
}

/** Diferença em dias entre uma data ISO (AAAA-MM-DD) e hoje. */
function diasDesde(dataISO) {
  if (!dataISO) return 9999; // nunca serviu -> tratado como "há muitíssimo tempo"
  const dataAlvo = new Date(dataISO);
  const hoje = new Date();
  const diffMs = hoje - dataAlvo;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
