/* ==========================================================================
   notifications.js (app do Coordenador)
   Notificações gerais do coordenador: eventos criados, escalas publicadas,
   membros autocadastrados aguardando revisão.
   ========================================================================== */

const Notifications = {
  itens: [],

  async carregar() {
    if (!Auth.sessaoAtiva) return;
    const resposta = await Api.buscar("notificacoes", { destinatario: "todos" });
    if (resposta.sucesso) {
      this.itens = resposta.dados || [];
      this._atualizarSino();
    }
  },

  _atualizarSino() {
    const naoLidas = this.itens.filter((n) => !n.lida && n.lida !== "true").length;
    const botao = document.getElementById("btn-notificacoes");
    if (!botao) return;
    botao.textContent = naoLidas > 0 ? `🔔 ${naoLidas}` : "🔔";
    botao.style.fontWeight = naoLidas > 0 ? "700" : "400";
  },

  abrirPainel() {
    const html = `
      <h2>Notificações</h2>
      <div style="display:flex; flex-direction:column; gap:10px; max-height:60vh; overflow-y:auto;">
        ${this.itens.length === 0
          ? `<p style="color:var(--cor-texto-secundario);">Nenhuma notificação.</p>`
          : this.itens.map((n) => `
            <div class="card" style="${n.lida === true || n.lida === "true" ? "opacity:0.55;" : ""}">
              <strong style="font-size:var(--tamanho-sm);">${_escapar(n.tipo)}</strong>
              <p style="margin-top:4px;">${_escapar(n.mensagem)}</p>
              <span style="color:var(--cor-texto-secundario); font-size:var(--tamanho-xs);">${_escapar(n.data)}</span>
            </div>`).join("")}
      </div>
      <button class="botao botao-texto botao-bloco" onclick="UI.fecharModal()" style="margin-top:16px;">Fechar</button>
    `;
    UI.abrirModal(html);
    this._marcarTodasComoLidas();
  },

  async _marcarTodasComoLidas() {
    const idsNaoLidas = this.itens
      .filter((n) => !n.lida && n.lida !== "true")
      .map((n) => n.id);
    if (idsNaoLidas.length === 0) return;
    await Api.atualizar("notificacoes", { marcarLidas: idsNaoLidas });
    this.itens.forEach((n) => (n.lida = true));
    this._atualizarSino();
  },
};

document.getElementById("btn-notificacoes")?.addEventListener("click", () => {
  Notifications.abrirPainel();
});
