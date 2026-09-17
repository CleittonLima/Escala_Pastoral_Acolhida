/**
 * Config.gs
 * Define a estrutura de todas as abas da planilha (criadas automaticamente
 * na primeira execução) e as funções de CONFIGURACOES: senha do
 * administrador, exportação/importação de backup.
 */

/** Mapa nomeDaAba -> lista de colunas, na ordem em que aparecem na planilha. */
const CABECALHOS_ABAS = {
  MEMBROS: [
    "id", "nome", "apelido", "telefone", "whatsapp", "email", "casado", "nomeConjuge",
    "participaDe", "comunidade", "preferenciaIgreja", "preferenciaHorarios", "sexo", "categoriaServico", "observacoes", "status", "dataCadastro",
    "vinculoConjugeId", "casalPendente", "autoCadastro",
  ],
  ESCALAS: [
    "id", "mesReferencia", "igrejaId", "igrejaNome", "eventoId", "eventoNome",
    "data", "horario", "funcao", "membroId", "membroNome", "grupoId", "tipoUnidade", "status", "dataPublicacao",
  ],
  EVENTOS: [
    "id", "nome", "data", "hora", "local", "qtdCasais", "qtdJovens", "qtdAdultos", "observacoes",
  ],
  IGREJAS: [
    "id", "nome", "padroeiro", "comunidade", "endereco", "horarios", "minutosChegada",
    "qtdCasais", "qtdJovens", "qtdAdultos", "observacoes",
  ],
  HISTORICO: [
    "id", "membroId", "membroNome", "data", "local", "evento", "horario", "funcao", "presenca",
  ],
  DISPONIBILIDADE: [
    "id", "membroId", "mesReferencia", "quinta", "sabado", "domingoManha",
    "domingoNoite", "observacoesMes", "congelada",
  ],
  CONFIGURACOES: ["chave", "valor"],
  NOTIFICACOES: ["id", "destinatario", "tipo", "mensagem", "data", "lida"],
  PRIORIDADES:  ["id", "membroId", "mesReferencia"],
};

/** Garante que todas as abas existam (chamado no início de doGet/doPost). */
function garantirEstruturaCompleta() {
  Object.keys(CABECALHOS_ABAS).forEach((nomeAba) => obterAba(nomeAba));
  _garantirSenhaPadrao();
}

/** Na primeira execução, define uma senha padrão para o administrador trocar depois. */
function _garantirSenhaPadrao() {
  const configuracoes = lerTodasAsLinhas("CONFIGURACOES");
  const jaTemSenha = configuracoes.some((c) => c.chave === "senhaAdminHash");
  if (!jaTemSenha) {
    inserirLinha("CONFIGURACOES", { chave: "senhaAdminHash", valor: hashSenha("rosario2026") });
  }
}

function obterConfiguracoes(parametros) {
  if (parametros.verificarSenha !== undefined) {
    return respostaSucesso({ senhaValida: _senhaAdminValida(parametros.verificarSenha) });
  }
  if (parametros.exportarBackup) {
    return respostaSucesso(_montarBackupCompleto());
  }
  const configuracoes = lerTodasAsLinhas("CONFIGURACOES");
  const objeto = {};
  configuracoes.forEach((c) => {
    if (c.chave !== "senhaAdminHash") objeto[c.chave] = c.valor;
  });
  return respostaSucesso(objeto);
}

function atualizarConfiguracoes(dados) {
  if (dados.novaSenhaAdmin) {
    _definirValorConfiguracao("senhaAdminHash", hashSenha(dados.novaSenhaAdmin));
    return respostaSucesso({ atualizado: true });
  }

  Object.keys(dados).forEach((chave) => _definirValorConfiguracao(chave, dados[chave]));
  return respostaSucesso({ atualizado: true });
}

/** CONFIGURACOES usa "chave" como identificador (não "id"), então tem função própria. */
function _definirValorConfiguracao(chave, valor) {
  const aba = obterAba("CONFIGURACOES");
  const dadosAtuais = aba.getDataRange().getValues();

  for (let i = 1; i < dadosAtuais.length; i++) {
    if (dadosAtuais[i][0] === chave) {
      aba.getRange(i + 1, 2).setValue(valor);
      return;
    }
  }
  aba.appendRow([chave, valor]);
}

function _senhaAdminValida(senhaDigitada) {
  const configuracoes = lerTodasAsLinhas("CONFIGURACOES");
  const linha = configuracoes.find((c) => c.chave === "senhaAdminHash");
  if (!linha) return false;
  return hashSenha(senhaDigitada) === linha.valor;
}

function _montarBackupCompleto() {
  const backup = {};
  Object.keys(CABECALHOS_ABAS).forEach((nomeAba) => {
    if (nomeAba === "CONFIGURACOES") return; // nunca exporta a senha
    backup[nomeAba] = lerTodasAsLinhas(nomeAba);
  });
  backup._geradoEm = new Date().toISOString();
  return backup;
}
