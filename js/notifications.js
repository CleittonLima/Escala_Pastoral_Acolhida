/* ==========================================================================
   notifications.js
   Sistema de notificações: disponibilidade aberta, escala publicada,
   escala alterada, lembrete véspera de servir, novo evento cadastrado.
   ========================================================================== */

const Notifications = {
  itens: [],

  async carregar() {
    if (!Auth.membroLogado && Auth.sessaoAtiva !== "admin") return;
    const destinatario = Auth.sessaoAtiva === "membro" ? Auth.membroLogado.id : "todos";
    const resposta = await Api.buscar("notificacoes", { destinatario });

    if (resposta.sucesso) {
      this.itens = resposta.dados || [];
      this._atualizarSino();
    }
  },

  _atualizarSino() {
    const naoLidas = this.itens.filter((n) => !n.lida).length;
    const botao = document.getElementById("btn-notificacoes");
    if (!botao) return;
    botao.textContent = naoLidas > 0 ? `🔔 ${naoLidas}` : "🔔";
  },

  abrirPainel() {
    const html = `
      <h2>Notificações</h2>
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${
          this.itens.length === 0
            ? `<p style="color:var(--cor-texto-secundario);">Nenhuma notificação por aqui.</p>`
            : this.itens
                .map(
                  (n) => `
              <div class="card" style="${n.lida ? "opacity:0.6;" : ""}">
                <strong style="font-size:var(--tamanho-sm);">${_escapar(n.tipo)}</strong>
                <p style="margin-top:4px;">${_escapar(n.mensagem)}</p>
                <span style="color:var(--cor-texto-secundario); font-size:var(--tamanho-xs);">${_escapar(n.data)}</span>
              </div>`
                )
                .join("")
        }
      </div>
      <button class="botao botao-texto botao-bloco" onclick="UI.fecharModal()" style="margin-top:16px;">Fechar</button>
    `;
    UI.abrirModal(html);
    this._marcarTodasComoLidas();
  },

  async _marcarTodasComoLidas() {
    const idsNaoLidas = this.itens.filter((n) => !n.lida).map((n) => n.id);
    if (idsNaoLidas.length === 0) return;
    await Api.atualizar("notificacoes", { marcarLidas: idsNaoLidas });
    this.itens.forEach((n) => (n.lida = true));
    this._atualizarSino();
  },
};

function _escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

document.getElementById("btn-notificacoes")?.addEventListener("click", () => {
  Notifications.abrirPainel();
});
