/* ==========================================================================
   auth.js (app do Coordenador)
   Autenticação por senha real com token de sessão (8h). O token é salvo
   no localStorage e enviado automaticamente em toda requisição via api.js.
   ========================================================================== */

const Auth = {
  sessaoAtiva: false,

  /** Restaura sessão salva se o token ainda existir. */
  restaurarSessao() {
    this.sessaoAtiva = Storage.obter(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN) === "ativa"
                    && !!Storage.obter(CONFIG.CHAVES_LOCAL.TOKEN_COORD);
    return this.sessaoAtiva;
  },

  /** Login: valida senha no backend, recebe e salva token. */
  async entrar(senha) {
    const resultado = await Api.loginCoordenador(senha);
    if (resultado.sucesso) {
      this.sessaoAtiva = true;
    }
    return resultado;
  },

  sair() {
    this.sessaoAtiva = false;
    Api.logoutCoordenador();
    document.getElementById("sidebar").hidden = true;
    document.getElementById("sidebar").classList.remove("aberto");
    document.getElementById("sidebar-overlay").hidden = true;
    UI.reiniciarHistorico();
    UI.navegarPara("tela-inicial", { empilhar: false });
  },
};

document.getElementById("form-login-admin")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const senha = document.getElementById("senha-admin").value;
  const botao = evento.target.querySelector("button[type=submit]");
  botao.disabled = true;
  botao.textContent = "Verificando...";

  const resultado = await Auth.entrar(senha);

  botao.disabled = false;
  botao.textContent = "Entrar";

  if (!resultado.sucesso) {
    UI.mostrarToast(resultado.erro || "Senha incorreta.");
    return;
  }

  await App.abrirPainelAdmin();
});

document.getElementById("btn-sair-admin")?.addEventListener("click", () => Auth.sair());
