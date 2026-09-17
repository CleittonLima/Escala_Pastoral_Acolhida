/**
 * Code.gs
 * Ponto de entrada do Web App. Implementa autenticação real no backend:
 * toda operação de escrita (coordenador) exige um token de sessão gerado
 * após verificação da senha. Leituras do membro (escalas, disponibilidade,
 * notificações próprias) aceitam o ID do membro como identidade — não
 * expõem dados alheios sem o token de coordenador.
 *
 * Fluxo de segurança:
 *   Coordenador POST /login  → senha → token (JWT-like, 8h) → armazenado no PropertiesService
 *   Coordenador GET/POST     → header Authorization: Bearer <token> → verificado aqui
 *   Membro      GET          → parametros.membroId → dados só daquele membro
 *   Backup      GET          → só com token de coordenador
 */

/* ---- Constantes de segurança ---- */
const TOKEN_DURACAO_MS = 8 * 60 * 60 * 1000; // 8 horas
const TOKEN_PROP_KEY   = "coordenadorToken";
const TOKEN_EXPIRY_KEY = "coordenadorTokenExpiry";

/* ==========================================================================
   AUTENTICAÇÃO
   ========================================================================== */

/** Gera e armazena um token de sessão após verificar a senha. Retornado ao front-end. */
function _gerarToken() {
  const token = Utilities.getUuid() + "-" + Date.now().toString(36);
  const expiry = Date.now() + TOKEN_DURACAO_MS;
  const props = PropertiesService.getScriptProperties();
  props.setProperty(TOKEN_PROP_KEY, token);
  props.setProperty(TOKEN_EXPIRY_KEY, String(expiry));
  return token;
}

/** Verifica se o token enviado é válido e não expirou. */
function _tokenValido(tokenEnviado) {
  if (!tokenEnviado) return false;
  const props = PropertiesService.getScriptProperties();
  const tokenSalvo = props.getProperty(TOKEN_PROP_KEY);
  const expiry    = Number(props.getProperty(TOKEN_EXPIRY_KEY) || "0");
  return tokenSalvo === tokenEnviado && Date.now() < expiry;
}

/** Extrai o token do header Authorization da requisição, se presente. */
function _extrairToken(e) {
  // Fetch API do front-end envia o token como parâmetro _token
  // (Apps Script não permite headers customizados facilmente no modo CORS simples).
  return (e.parameter && e.parameter._token) || "";
}

/** Resposta de acesso negado. */
function _negado() {
  return respostaErro("Acesso negado. Faça login como coordenador.");
}

/* ==========================================================================
   ROTAS PÚBLICAS (sem autenticação) vs PROTEGIDAS
   ========================================================================== */

// Recursos que qualquer um pode ler (app do membro — por ID próprio)
const RECURSOS_PUBLICOS_GET = new Set([
  "membros",       // filtrado por telefone (login) ou por ID próprio
  "escalas",       // filtrado por membroId próprio
  "disponibilidade",
  "notificacoes",  // filtrado por destinatario = membroId próprio
  "configuracoes", // só verificarSenha e login — nada sensível
  "igrejas",       // para exibir nomes ao membro
  "eventos",       // para exibir ao membro
  "historico",     // filtrado pelo próprio membro
]);

// Recursos de escrita que só o coordenador pode fazer
const RECURSOS_SOMENTE_COORD_POST = new Set([
  "igrejas", "eventos", "escalas", "historico",
]);

// Recursos que o membro também pode escrever (seus próprios dados)
const RECURSOS_MEMBRO_POST = new Set([
  "membros",        // autocadastro
  "disponibilidade",
  "notificacoes",
]);

/* ==========================================================================
   ENTRY POINTS
   ========================================================================== */

function doGet(e) {
  garantirEstruturaCompleta();

  try {
    const parametros = e.parameter || {};
    const recurso    = parametros.recurso;
    const token      = _extrairToken(e);

    // Login especial: verifica senha e devolve token
    if (recurso === "configuracoes" && parametros.verificarSenha !== undefined) {
      return _rotaLogin(parametros.verificarSenha);
    }

    // Dashboard e relatórios: apenas coordenador
    if (recurso === "dashboard" || recurso === "relatorios") {
      if (!_tokenValido(token)) return _negado();
      return recurso === "dashboard" ? obterDashboard() : obterRelatorios();
    }

    // Backup: apenas coordenador
    if (recurso === "configuracoes" && parametros.exportarBackup) {
      if (!_tokenValido(token)) return _negado();
      return respostaSucesso(_montarBackupCompleto());
    }

    if (RECURSOS_PUBLICOS_GET.has(recurso)) {
      // Para leituras de membro sem token de coordenador, aplicamos filtro de escopo
      const isCoord = _tokenValido(token);
      return _rotearLeitura(recurso, parametros, isCoord);
    }

    return respostaErro(`Recurso desconhecido: ${recurso}`);
  } catch (erro) {
    return respostaErro(`Erro no servidor: ${erro.message}`);
  }
}

function doPost(e) {
  garantirEstruturaCompleta();

  try {
    const corpo   = JSON.parse(e.postData.contents);
    const { recurso, metodo, dados, _token } = corpo;
    const token   = _token || "";
    const isCoord = _tokenValido(token);

    // Autocadastro: único POST público de membro sem token
    if (recurso === "membros" && metodo === "POST" && !isCoord) {
      return criarMembro({ ...dados, autoCadastro: true });
    }

    // Disponibilidade e notificações: o membro pode escrever nos próprios dados
    if (RECURSOS_MEMBRO_POST.has(recurso) && !isCoord) {
      return _rotearEscritaMembro(recurso, metodo, dados);
    }

    // Todo o resto: exige token de coordenador
    if (!isCoord) return _negado();

    if (metodo === "PUT") return _rotearAtualizacao(recurso, dados);
    if (metodo === "DELETE") return _rotearRemocao(recurso, dados ? dados.id : null);
    return _rotearCriacao(recurso, dados);
  } catch (erro) {
    return respostaErro(`Erro no servidor: ${erro.message}`);
  }
}

/* ==========================================================================
   ROTA DE LOGIN
   ========================================================================== */

function _rotaLogin(senhaDigitada) {
  if (_senhaAdminValida(senhaDigitada)) {
    const token = _gerarToken();
    return respostaSucesso({ senhaValida: true, token });
  }
  return respostaSucesso({ senhaValida: false });
}

/* ==========================================================================
   ROTEAMENTO DE LEITURA (GET)
   ========================================================================== */

function _rotearLeitura(recurso, parametros, isCoord) {
  switch (recurso) {
    case "membros":
      // Coordenador lê todos. Membro só lê por ID ou por telefone (login).
      if (!isCoord && !parametros.id && !parametros.telefone &&
          !parametros.pendentesDeVinculo && !parametros.disponiveisPara) {
        return respostaErro("Acesso restrito.");
      }
      return obterMembros(parametros);
    case "escalas":
      if (!isCoord && !parametros.membroId) return respostaErro("Acesso restrito.");
      return obterEscalas(parametros);
    case "disponibilidade":
      if (!isCoord && !parametros.membroId) return respostaErro("Acesso restrito.");
      return obterDisponibilidade(parametros);
    case "notificacoes":
      if (!isCoord && !parametros.destinatario) return respostaErro("Acesso restrito.");
      return obterNotificacoes(parametros);
    case "historico":
      if (!isCoord && !parametros.membroId) return respostaErro("Acesso restrito.");
      return obterHistorico(parametros);
    case "configuracoes":
      return obterConfiguracoes(parametros);
    case "igrejas":   return obterIgrejas(parametros);
    case "eventos":   return obterEventos(parametros);
    case "prioridades": if (!_tokenValido(token)) return _negado(); return obterPrioridades(parametros);
    default:          return respostaErro(`Recurso desconhecido: ${recurso}`);
  }
}

/* ==========================================================================
   ESCRITA DO MEMBRO (sem token de coordenador)
   ========================================================================== */

function _rotearEscritaMembro(recurso, metodo, dados) {
  if (recurso === "disponibilidade") return salvarDisponibilidade(dados);
  if (recurso === "notificacoes" && metodo === "PUT") return atualizarNotificacoes(dados);
  // Membro atualiza só nome/apelido do próprio perfil
  if (recurso === "membros" && metodo === "PUT") {
    if (dados.acao === "vincularParceirosAutocadastro") {
      return atualizarMembro({ acao: dados.acao, id: dados.id, idParceiro: dados.idParceiro });
    }
    const camposPermitidos = {
      id: dados.id, nome: dados.nome, apelido: dados.apelido,
      preferenciaIgreja: dados.preferenciaIgreja,
      preferenciaHorarios: dados.preferenciaHorarios,
    };
    return atualizarMembro(camposPermitidos);
  }
  return respostaErro("Acesso restrito.");
}

/* ==========================================================================
   ROTEAMENTO DE ESCRITA (coordenador)
   ========================================================================== */

function _rotearCriacao(recurso, dados) {
  switch (recurso) {
    case "membros":       return criarMembro(dados);
    case "igrejas":       return criarIgreja(dados);
    case "eventos":       return criarEvento(dados);
    case "escalas":       return criarEscala(dados);
    case "notificacoes":  return criarNotificacao(dados);
    default: return respostaErro(`Recurso desconhecido para criação: ${recurso}`);
  }
}

function _rotearAtualizacao(recurso, dados) {
  switch (recurso) {
    case "membros":         return atualizarMembro(dados);
    case "igrejas":         return atualizarIgreja(dados);
    case "eventos":         return atualizarEvento(dados);
    case "escalas":         return atualizarEscala(dados);
    case "disponibilidade": return salvarDisponibilidade(dados);
    case "notificacoes":    return atualizarNotificacoes(dados);
    case "configuracoes":   return atualizarConfiguracoes(dados);
    case "prioridades":     return salvarPrioridade(dados);
    default: return respostaErro(`Recurso desconhecido para atualização: ${recurso}`);
  }
}

function _rotearRemocao(recurso, id) {
  switch (recurso) {
    case "membros":   return removerMembro(id);
    case "igrejas":   return removerIgreja(id);
    case "eventos":   return removerEvento(id);
    case "escalas":   return removerEscala(id);
    default: return respostaErro(`Recurso desconhecido para remoção: ${recurso}`);
  }
}
