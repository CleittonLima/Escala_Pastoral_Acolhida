/* ==========================================================================
   auth.js (app do Coordenador)
   Autenticação do Coordenador por senha (verificada no backend). Este app
   NÃO contém nenhuma lógica de membro — isso vive inteiramente em
   /membro/js/auth.js, em outro projeto/URL.
   ========================================================================== */

const Auth = {
  sessaoAtiva: false,

  /** Restaura sessão salva neste dispositivo, se houver. */
  restaurarSessao() {
    this.sessaoAtiva = Storage.obter(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN) === "ativa";
    return this.sessaoAtiva;
  },

  async entrar(senha) {
    const resposta = await Api.buscar("configuracoes", { verificarSenha: senha });
    if (!resposta.sucesso || !resposta.dados?.senhaValida) {
      return { sucesso: false, erro: "Senha incorreta." };
    }
    this.sessaoAtiva = true;
    Storage.salvar(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN, "ativa");
    return { sucesso: true };
  },

  sair() {
    this.sessaoAtiva = false;
    Storage.remover(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN);
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
    UI.mostrarToast(resultado.erro);
    return;
  }

  await App.abrirPainelAdmin();
});

document.getElementById("btn-sair-admin")?.addEventListener("click", () => Auth.sair());
