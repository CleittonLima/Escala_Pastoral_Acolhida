/* ==========================================================================
   auth.js (app do Membro)
   Autenticação do Membro por telefone cadastrado. Este app NÃO contém
   nenhuma lógica de administrador — isso vive inteiramente em
   /coordenador/js/auth.js, em outro projeto/URL.
   ========================================================================== */

const Auth = {
  membroLogado: null,

  /** Restaura sessão salva neste dispositivo, se houver. */
  async restaurarSessao() {
    const idMembroSalvo = Storage.obter(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO);
    if (!idMembroSalvo) return false;

    const resposta = await Api.buscar("membros", { id: idMembroSalvo });
    if (resposta.sucesso && resposta.dados) {
      this.membroLogado = resposta.dados;
      return true;
    }
    Storage.remover(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO);
    return false;
  },

  /** Login do membro por telefone. */
  async entrar(telefone) {
    const telefoneLimpo = telefone.replace(/\D/g, "");
    const resposta = await Api.buscar("membros", { telefone: telefoneLimpo });

    if (!resposta.sucesso || !resposta.dados) {
      return { sucesso: false, erro: resposta.erro || "Telefone não encontrado. Fale com o coordenador." };
    }

    this.membroLogado = resposta.dados;
    Storage.salvar(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO, resposta.dados.id);
    return { sucesso: true };
  },

  sair() {
    this.membroLogado = null;
    Storage.remover(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO);
    UI.reiniciarHistorico();
    UI.navegarPara("tela-inicial", { empilhar: false });
  },
};

/* ---- Formulário: login do membro ---- */
document.getElementById("form-login-membro")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const telefone = document.getElementById("login-telefone").value;
  const botao = evento.target.querySelector("button[type=submit]");
  botao.disabled = true;
  botao.textContent = "Entrando...";

  const resultado = await Auth.entrar(telefone);

  botao.disabled = false;
  botao.textContent = "Entrar";

  if (!resultado.sucesso) {
    UI.mostrarToast(resultado.erro);
    return;
  }

  await App.abrirPainelDoMembro();
});

document.getElementById("btn-sair-membro")?.addEventListener("click", () => Auth.sair());
