/* ==========================================================================
   ui.js
   Utilitários de interface, compartilhados pelos dois apps (Membro e
   Coordenador): navegação entre telas, tema claro/escuro, modal genérico
   e mensagens toast. Não contém lógica de negócio.

   Convenção usada por cada tela (ver atributos no HTML):
   - data-titulo="Texto"  -> título mostrado na barra superior
   - data-sem-nav="true"  -> tela pública (login/inicial): esconde a barra
     superior e a navegação inferior, mostra o rodapé institucional.
   ========================================================================== */

const UI = {
  telaAtual: null,
  historicoTelas: [],

  /** Mostra uma tela e esconde as demais (dentro de #conteudo-principal). */
  navegarPara(idTela, opcoes = {}) {
    const { empilhar = true } = opcoes;
    const telaAlvo = document.getElementById(idTela);
    if (!telaAlvo) return;

    document.querySelectorAll("#conteudo-principal .tela").forEach((tela) => {
      tela.hidden = tela.id !== idTela;
    });

    if (empilhar && this.telaAtual && this.telaAtual !== idTela) {
      this.historicoTelas.push(this.telaAtual);
    }
    this.telaAtual = idTela;

    this._atualizarTopbar(telaAlvo);
    this._atualizarNavInferior(telaAlvo, idTela);
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  voltar() {
    const anterior = this.historicoTelas.pop();
    if (anterior) this.navegarPara(anterior, { empilhar: false });
  },

  /** Reinicia o histórico de navegação (usado ao entrar/sair de sessão). */
  reiniciarHistorico() {
    this.historicoTelas = [];
  },

  _atualizarTopbar(telaAlvo) {
    const topbar = document.getElementById("topbar");
    const btnVoltar = document.getElementById("btn-voltar");
    const titulo = document.getElementById("topbar-titulo");
    if (!topbar) return;

    const telaPublica = telaAlvo.dataset.semNav === "true";
    topbar.hidden = telaPublica;
    if (btnVoltar) btnVoltar.hidden = this.historicoTelas.length === 0;
    if (titulo) titulo.textContent = telaAlvo.dataset.titulo || CONFIG.NOME_CURTO;
  },

  _atualizarNavInferior(telaAlvo, idTela) {
    const nav = document.getElementById("nav-principal");
    const rodape = document.getElementById("rodape-institucional");
    const telaPublica = telaAlvo.dataset.semNav === "true";

    if (nav) {
      nav.hidden = telaPublica;
      nav.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("ativo", item.dataset.navegar === idTela);
      });
    }

    // O rodapé institucional é um único elemento que "se move" para dentro
    // da aba atualmente visível, sempre no fim do conteúdo dela — em vez de
    // ficar fixo abaixo da navegação (o que empurrava a navegação para fora
    // do lugar quando o conteúdo era curto).
    if (rodape) telaAlvo.appendChild(rodape);
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
