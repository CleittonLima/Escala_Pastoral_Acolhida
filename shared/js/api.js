/* ==========================================================================
   api.js
   Camada única de comunicação com o backend (Google Apps Script + Sheets).
   Após o login do coordenador, o token de sessão é incluído automaticamente
   em todas as requisições — sem precisar passá-lo manualmente em nenhum
   outro arquivo. O membro não usa token (as rotas de leitura do membro
   são filtradas por ID no backend).
   ========================================================================== */

const Api = {
  /**
   * Lê o token de coordenador do localStorage (se existir).
   * Retorna "" se não houver sessão de coordenador ativa.
   */
  _tokenAtual() {
    return Storage.obter(CONFIG.CHAVES_LOCAL.TOKEN_COORD) || "";
  },

  /** Busca dados (GET). Inclui token automaticamente se disponível. */
  async buscar(recurso, parametros = {}) {
    const url = new URL(CONFIG.URL_API);
    url.searchParams.set("recurso", recurso);

    const token = this._tokenAtual();
    if (token) url.searchParams.set("_token", token);

    Object.entries(parametros).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null) url.searchParams.set(chave, valor);
    });

    try {
      const resposta = await fetch(url.toString(), { method: "GET" });
      return await this._tratarResposta(resposta);
    } catch (erro) {
      return this._erroDeRede(erro);
    }
  },

  /** Cria novo registro (POST). */
  async criar(recurso, dados) {
    return this._enviar("POST", recurso, dados);
  },

  /** Atualiza registro (PUT). */
  async atualizar(recurso, dados) {
    return this._enviar("PUT", recurso, dados);
  },

  /** Remove registro (DELETE). */
  async remover(recurso, id) {
    return this._enviar("DELETE", recurso, { id });
  },

  /* ---- Login especial: autentica e salva o token ---- */
  async loginCoordenador(senha) {
    const resposta = await this.buscar("configuracoes", { verificarSenha: senha });
    if (resposta.sucesso && resposta.dados?.senhaValida && resposta.dados?.token) {
      Storage.salvar(CONFIG.CHAVES_LOCAL.TOKEN_COORD, resposta.dados.token);
      Storage.salvar(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN, "ativa");
      return { sucesso: true };
    }
    return { sucesso: false, erro: "Senha incorreta." };
  },

  /** Remove o token ao sair. */
  logoutCoordenador() {
    Storage.remover(CONFIG.CHAVES_LOCAL.TOKEN_COORD);
    Storage.remover(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN);
  },

  /* ---- Internos ---- */
  async _enviar(metodo, recurso, dados) {
    try {
      const token = this._tokenAtual();
      const resposta = await fetch(CONFIG.URL_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ recurso, metodo, dados, _token: token }),
      });
      return await this._tratarResposta(resposta);
    } catch (erro) {
      return this._erroDeRede(erro);
    }
  },

  async _tratarResposta(resposta) {
    if (!resposta.ok) return { sucesso: false, erro: `Erro HTTP ${resposta.status}` };
    try {
      const json = await resposta.json();
      // Se o backend responder "Acesso negado", limpa a sessão local automaticamente
      if (!json.sucesso && json.erro && json.erro.startsWith("Acesso negado")) {
        Storage.remover(CONFIG.CHAVES_LOCAL.TOKEN_COORD);
        Storage.remover(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN);
      }
      return json;
    } catch {
      return { sucesso: false, erro: "Resposta inválida do servidor." };
    }
  },

  _erroDeRede(erro) {
    console.error("[api] falha de rede:", erro);
    return {
      sucesso: false,
      erro: "Não foi possível conectar ao servidor. Verifique sua internet.",
    };
  },
};
