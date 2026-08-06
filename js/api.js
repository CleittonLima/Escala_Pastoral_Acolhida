/* ==========================================================================
   api.js
   Camada única de comunicação com o backend (Google Apps Script + Sheets).
   Todas as outras camadas (members.js, scheduler.js, etc.) passam por aqui
   em vez de chamar fetch() diretamente — isso mantém a URL, o tratamento
   de erro e o formato de requisição centralizados em um só lugar.
   ========================================================================== */

const Api = {
  /**
   * Executa uma leitura (GET) no backend.
   * @param {string} recurso - nome do recurso: "membros", "escalas", "igrejas",
   *   "eventos", "historico", "disponibilidade", "notificacoes", "configuracoes".
   * @param {Object} [parametros] - filtros opcionais (ex.: {membroId, mes}).
   */
  async buscar(recurso, parametros = {}) {
    const url = new URL(CONFIG.URL_API);
    url.searchParams.set("recurso", recurso);
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

  /** Cria um novo registro (POST). */
  async criar(recurso, dados) {
    return this._enviar("POST", recurso, dados);
  },

  /** Atualiza um registro existente (PUT). */
  async atualizar(recurso, dados) {
    return this._enviar("PUT", recurso, dados);
  },

  /** Remove um registro (DELETE). */
  async remover(recurso, id) {
    return this._enviar("DELETE", recurso, { id });
  },

  /* ---- Internos ---- */

  async _enviar(metodo, recurso, dados) {
    // O Apps Script Web App só aceita GET/POST nativamente de forma simples
    // (sem CORS preflight complexo), então PUT/DELETE são simulados via POST
    // com um campo "_metodo" — Code.gs lê esse campo e roteia corretamente.
    try {
      const resposta = await fetch(CONFIG.URL_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ recurso, metodo, dados }),
      });
      return await this._tratarResposta(resposta);
    } catch (erro) {
      return this._erroDeRede(erro);
    }
  },

  async _tratarResposta(resposta) {
    if (!resposta.ok) {
      return { sucesso: false, erro: `Erro HTTP ${resposta.status}` };
    }
    try {
      const json = await resposta.json();
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
