/* ==========================================================================
   storage.js
   Camada de acesso ao localStorage. Usado EXCLUSIVAMENTE para preferências
   locais do dispositivo (tema, cor personalizada, sessão do membro/admin
   neste aparelho). Os dados do sistema (membros, escalas, etc.) vivem no
   Google Sheets e nunca passam por aqui.
   ========================================================================== */

const Storage = {
  /** Lê um valor salvo localmente. Retorna null se não existir. */
  obter(chave) {
    try {
      return localStorage.getItem(chave);
    } catch (erro) {
      console.warn("[storage] leitura falhou:", erro);
      return null;
    }
  },

  /** Lê e faz parse de um valor JSON salvo localmente. */
  obterJSON(chave) {
    const valor = this.obter(chave);
    if (!valor) return null;
    try {
      return JSON.parse(valor);
    } catch {
      return null;
    }
  },

  /** Salva um valor simples (string) localmente. */
  salvar(chave, valor) {
    try {
      localStorage.setItem(chave, valor);
    } catch (erro) {
      console.warn("[storage] escrita falhou:", erro);
    }
  },

  /** Salva um objeto como JSON localmente. */
  salvarJSON(chave, objeto) {
    this.salvar(chave, JSON.stringify(objeto));
  },

  /** Remove um valor salvo localmente. */
  remover(chave) {
    try {
      localStorage.removeItem(chave);
    } catch (erro) {
      console.warn("[storage] remoção falhou:", erro);
    }
  },
};
