/* ==========================================================================
   auth.js
   Autenticação de Membro (identificação por telefone cadastrado) e de
   Administrador (senha guardada nas CONFIGURACOES da planilha, nunca em
   texto puro no front-end — a verificação acontece no Apps Script).
   ========================================================================== */

const Auth = {
  sessaoAtiva: null,   // "membro" | "admin" | null
  membroLogado: null,  // objeto do membro autenticado

  /** Restaura sessão salva neste dispositivo, se houver. */
  async restaurarSessao() {
    const idMembroSalvo = Storage.obter(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO);
    const sessaoAdminSalva = Storage.obter(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN);

    if (sessaoAdminSalva === "ativa") {
      this.sessaoAtiva = "admin";
      return "admin";
    }

    if (idMembroSalvo) {
      const resposta = await Api.buscar("membros", { id: idMembroSalvo });
      if (resposta.sucesso && resposta.dados) {
        this.membroLogado = resposta.dados;
        this.sessaoAtiva = "membro";
        return "membro";
      }
      Storage.remover(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO);
    }
    return null;
  },

  /** Login do membro por telefone. */
  async entrarComoMembro(telefone) {
    const telefoneLimpo = telefone.replace(/\D/g, "");
    const resposta = await Api.buscar("membros", { telefone: telefoneLimpo });

    if (!resposta.sucesso || !resposta.dados) {
      return { sucesso: false, erro: resposta.erro || "Telefone não encontrado. Fale com o coordenador." };
    }

    this.membroLogado = resposta.dados;
    this.sessaoAtiva = "membro";
    Storage.salvar(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO, resposta.dados.id);
    return { sucesso: true };
  },

  /** Login do administrador por senha (validada no backend). */
  async entrarComoAdmin(senha) {
    const resposta = await Api.buscar("configuracoes", { verificarSenha: senha });

    if (!resposta.sucesso || !resposta.dados?.senhaValida) {
      return { sucesso: false, erro: "Senha incorreta." };
    }

    this.sessaoAtiva = "admin";
    Storage.salvar(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN, "ativa");
    return { sucesso: true };
  },

  sair() {
    this.sessaoAtiva = null;
    this.membroLogado = null;
    Storage.remover(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO);
    Storage.remover(CONFIG.CHAVES_LOCAL.SESSAO_ADMIN);
    UI.navegarPara("tela-inicial", { empilhar: false });
    UI.historicoTelas = [];
  },
};

/* ---- Formulário: login do membro ---- */
document.getElementById("form-login-membro")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const telefone = document.getElementById("login-telefone").value;
  const botao = evento.target.querySelector("button[type=submit]");
  botao.disabled = true;
  botao.textContent = "Entrando...";

  const resultado = await Auth.entrarComoMembro(telefone);

  botao.disabled = false;
  botao.textContent = "Entrar";

  if (!resultado.sucesso) {
    UI.mostrarToast(resultado.erro);
    return;
  }

  document.getElementById("saudacao-membro").textContent = `Olá, ${Auth.membroLogado.nome.split(" ")[0]}!`;
  await Members.carregarPainelMembro();
  UI.navegarPara("tela-membro-dashboard", { empilhar: false });
});

/* ---- Formulário: login do administrador ---- */
document.getElementById("form-login-admin")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const senha = document.getElementById("senha-admin").value;
  const botao = evento.target.querySelector("button[type=submit]");
  botao.disabled = true;
  botao.textContent = "Verificando...";

  const resultado = await Auth.entrarComoAdmin(senha);

  botao.disabled = false;
  botao.textContent = "Entrar";

  if (!resultado.sucesso) {
    UI.mostrarToast(resultado.erro);
    return;
  }

  await Dashboard.carregarPainelAdmin();
  UI.navegarPara("tela-admin-dashboard", { empilhar: false });
});

/* ---- Botão escondido de acesso administrativo (dentro de Configurações) ---- */
document.getElementById("btn-acesso-admin")?.addEventListener("click", () => {
  UI.navegarPara("tela-login-admin");
});
