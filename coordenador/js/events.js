/* ==========================================================================
   events.js
   CRUD de Eventos extraordinários (visão do Coordenador). Cada item tem
   ações explícitas de Editar (✏️) e Excluir (🗑️).
   ========================================================================== */

const Events = {
  lista: [],

  async carregar() {
    const container = document.getElementById("lista-admin-eventos");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;

    const resposta = await Api.buscar("eventos");
    if (!resposta.sucesso) {
      container.innerHTML = `<p style="color:var(--cor-alerta);">${resposta.erro}</p>`;
      return;
    }
    this.lista = (resposta.dados || []).sort((a, b) => (a.data > b.data ? 1 : -1));
    this._renderizarLista();
  },

  _renderizarLista() {
    const container = document.getElementById("lista-admin-eventos");
    if (this.lista.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhum evento cadastrado ainda. Toque em "+ Novo" para começar.</p>`;
      return;
    }
    container.innerHTML = this.lista
      .map(
        (ev) => `
        <div class="item-admin entrada-item">
          <div class="info-principal" data-abrir-evento="${ev.id}">
            <strong>${_escapar(ev.nome)}</strong>
            <span>${_escapar(ev.data)} às ${_escapar(ev.hora)} · ${_escapar(ev.local)}</span>
            <div class="badges-linha">
              <span class="badge badge-info">Casais: ${ev.qtdCasais ?? 0}</span>
              <span class="badge badge-info">Jovens: ${ev.qtdJovens ?? 0}</span>
            </div>
          </div>
          <div class="acoes">
            <button class="botao-icone icone-editar" data-editar-evento="${ev.id}" title="Editar" aria-label="Editar ${_escapar(ev.nome)}">✏️</button>
            <button class="botao-icone icone-excluir" data-excluir-evento="${ev.id}" title="Excluir" aria-label="Excluir ${_escapar(ev.nome)}">🗑️</button>
          </div>
        </div>`
      )
      .join("");

    container.querySelectorAll("[data-abrir-evento], [data-editar-evento]").forEach((el) => {
      el.addEventListener("click", () => this.abrirFormulario(el.dataset.abrirEvento || el.dataset.editarEvento));
    });

    container.querySelectorAll("[data-excluir-evento]").forEach((el) => {
      el.addEventListener("click", (evento) => {
        evento.stopPropagation();
        this.excluir(el.dataset.excluirEvento);
      });
    });
  },

  async excluir(idEvento) {
    const evento = this.lista.find((e) => e.id === idEvento);
    const confirmar = confirm(`Excluir "${evento?.nome || "este evento"}"?`);
    if (!confirmar) return;

    const resposta = await Api.remover("eventos", idEvento);
    if (resposta.sucesso) {
      UI.mostrarToast("Evento excluído.");
      this.carregar();
    } else {
      UI.mostrarToast(resposta.erro || "Não foi possível excluir.");
    }
  },

  abrirFormulario(idEvento = null) {
    const evento = idEvento ? this.lista.find((e) => e.id === idEvento) : {};
    const html = `
      <h2>${idEvento ? "Editar Evento" : "Novo Evento"}</h2>
      <form id="form-evento">
        <div class="campo"><label>Nome</label><input name="nome" required value="${_escapar(evento.nome)}" placeholder="Ex.: Novena de Nossa Senhora"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="campo"><label>Data</label><input type="date" name="data" required value="${_escapar(evento.data)}"></div>
          <div class="campo"><label>Hora</label><input type="time" name="hora" required value="${_escapar(evento.hora)}"></div>
        </div>
        <div class="campo"><label>Local</label><input name="local" required value="${_escapar(evento.local)}"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="campo"><label>Casais</label><input type="number" min="0" name="qtdCasais" value="${evento.qtdCasais ?? 0}"></div>
          <div class="campo"><label>Jovens</label><input type="number" min="0" name="qtdJovens" value="${evento.qtdJovens ?? 0}"></div>
        </div>
        <div class="campo"><label>Observações</label><textarea name="observacoes" rows="2">${_escapar(evento.observacoes)}</textarea></div>
        <button type="submit" class="botao botao-primario botao-bloco">Salvar</button>
      </form>
    `;
    UI.abrirModal(html);

    document.getElementById("form-evento").addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.target).entries());
      if (idEvento) dados.id = idEvento;

      const resposta = idEvento ? await Api.atualizar("eventos", dados) : await Api.criar("eventos", dados);
      if (resposta.sucesso) {
        UI.fecharModal();
        UI.mostrarToast("Evento salvo!");
        if (!idEvento) Api.criar("notificacoes", { destinatario: "todos", tipo: "Novo evento", mensagem: `Novo evento cadastrado: ${dados.nome}` });
        this.carregar();
      } else {
        UI.mostrarToast(resposta.erro || "Erro ao salvar.");
      }
    });
  },
};

document.getElementById("btn-novo-evento")?.addEventListener("click", () => Events.abrirFormulario());
