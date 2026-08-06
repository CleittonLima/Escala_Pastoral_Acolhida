/* ==========================================================================
   ui.js
   Utilitários de interface: navegação entre telas, tema claro/escuro,
   modal genérico e mensagens toast. Não contém lógica de negócio.
   ========================================================================== */

const UI = {
  telaAtual: "tela-inicial",
  historicoTelas: [],

  /** Mostra uma tela e esconde as demais (dentro de #conteudo-principal). */
  navegarPara(idTela, opcoes = {}) {
    const { empilhar = true } = opcoes;
    const telas = document.querySelectorAll("#conteudo-principal .tela");
    telas.forEach((tela) => (tela.hidden = tela.id !== idTela));

    if (empilhar && this.telaAtual !== idTela) {
      this.historicoTelas.push(this.telaAtual);
    }
    this.telaAtual = idTela;

    this._atualizarTopbar(idTela);
    this._atualizarNavInferior(idTela);
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  voltar() {
    const anterior = this.historicoTelas.pop();
    if (anterior) this.navegarPara(anterior, { empilhar: false });
  },

  _atualizarTopbar(idTela) {
    const topbar = document.getElementById("topbar");
    const btnVoltar = document.getElementById("btn-voltar");
    const titulo = document.getElementById("topbar-titulo");

    const ehTelaInicial = idTela === "tela-inicial";
    topbar.hidden = ehTelaInicial;
    btnVoltar.hidden = this.historicoTelas.length === 0;

    const titulos = {
      "tela-login-membro": "Entrar",
      "tela-membro-dashboard": "Início",
      "tela-minhas-escalas": "Minhas Escalas",
      "tela-disponibilidade": "Disponibilidade",
      "tela-historico-membro": "Meu Histórico",
      "tela-solicitar-troca": "Solicitar Troca",
      "tela-configuracoes": "Configurações",
      "tela-login-admin": "Acesso Administrativo",
      "tela-admin-dashboard": "Painel Administrativo",
      "tela-admin-membros": "Membros",
      "tela-admin-igrejas": "Igrejas",
      "tela-admin-eventos": "Eventos",
      "tela-admin-gerar-escala": "Gerar Escala",
      "tela-admin-historico": "Histórico Geral",
      "tela-admin-relatorios": "Relatórios",
      "tela-admin-configuracoes": "Configurações do Sistema",
    };
    titulo.textContent = titulos[idTela] || CONFIG.NOME_CURTO;
  },

  _atualizarNavInferior(idTela) {
    const navMembro = document.getElementById("nav-membro");
    const navAdmin = document.getElementById("nav-admin");
    const rodape = document.getElementById("rodape-institucional");

    const telasMembro = ["tela-membro-dashboard", "tela-minhas-escalas", "tela-disponibilidade", "tela-configuracoes"];
    const telasAdmin = ["tela-admin-dashboard", "tela-admin-membros", "tela-admin-gerar-escala", "tela-admin-configuracoes"];

    const mostrarNavMembro = telasMembro.includes(idTela) && Auth.sessaoAtiva === "membro";
    const mostrarNavAdmin = telasAdmin.includes(idTela) && Auth.sessaoAtiva === "admin";

    navMembro.hidden = !mostrarNavMembro;
    navAdmin.hidden = !mostrarNavAdmin;
    rodape.hidden = mostrarNavMembro || mostrarNavAdmin;

    if (mostrarNavMembro || mostrarNavAdmin) {
      const nav = mostrarNavMembro ? navMembro : navAdmin;
      nav.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("ativo", item.dataset.navegar === idTela);
      });
    }
  },

  /* ---- Tema ---- */
  aplicarTemaSalvo() {
    const tema = Storage.obter(CONFIG.CHAVES_LOCAL.TEMA) || "claro";
    document.documentElement.setAttribute("data-tema", tema);
    const toggle = document.getElementById("toggle-tema-escuro");
    if (toggle) toggle.checked = tema === "escuro";
  },

  alternarTema(escuro) {
    const tema = escuro ? "escuro" : "claro";
    document.documentElement.setAttribute("data-tema", tema);
    Storage.salvar(CONFIG.CHAVES_LOCAL.TEMA, tema);
  },

  /* ---- Modal genérico ---- */
  abrirModal(htmlConteudo) {
    const fundo = document.getElementById("modal-fundo");
    const caixa = document.getElementById("modal-caixa");
    caixa.innerHTML = htmlConteudo;
    fundo.hidden = false;
  },

  fecharModal() {
    document.getElementById("modal-fundo").hidden = true;
  },

  /* ---- Toast ---- */
  mostrarToast(mensagem, duracaoMs = 2600) {
    const existente = document.querySelector(".toast");
    if (existente) existente.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = mensagem;
    document.getElementById("app-container").appendChild(toast);

    setTimeout(() => toast.remove(), duracaoMs);
  },
};

/* ---- Delegação de eventos para qualquer botão com data-navegar ---- */
document.addEventListener("click", (evento) => {
  const alvo = evento.target.closest("[data-navegar]");
  if (alvo) UI.navegarPara(alvo.dataset.navegar);
});

document.getElementById("btn-voltar")?.addEventListener("click", () => UI.voltar());

document.getElementById("modal-fundo")?.addEventListener("click", (evento) => {
  if (evento.target.id === "modal-fundo") UI.fecharModal();
});
