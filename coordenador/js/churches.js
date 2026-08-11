/* ==========================================================================
   churches.js
   CRUD de Igrejas (visão do Coordenador): nome, padroeiro, comunidade,
   endereço, horários e quantidade necessária de casais/jovens/adultos.
   Cada item tem ações explícitas de Editar (✏️) e Excluir (🗑️).
   ========================================================================== */

const Churches = {
  lista: [],

  async carregar() {
    const container = document.getElementById("lista-admin-igrejas");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;

    const resposta = await Api.buscar("igrejas");
    if (!resposta.sucesso) {
      container.innerHTML = `<p style="color:var(--cor-alerta);">${resposta.erro}</p>`;
      return;
    }
    this.lista = resposta.dados || [];
    this._renderizarLista();
  },

  _renderizarLista() {
    const container = document.getElementById("lista-admin-igrejas");
    if (this.lista.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhuma igreja cadastrada ainda. Toque em "+ Nova" para começar.</p>`;
      return;
    }
    container.innerHTML = this.lista
      .map(
        (igreja) => `
        <div class="item-admin entrada-item">
          <div class="info-principal" data-abrir-igreja="${igreja.id}">
            <strong>${_escapar(igreja.nome)}</strong>
            <span>${_escapar(igreja.padroeiro || "")}${igreja.padroeiro ? " · " : ""}${_escapar(igreja.comunidade || "")}</span>
            <div class="badges-linha">
              <span class="badge badge-info">Casais: ${igreja.qtdCasais ?? 0}</span>
              <span class="badge badge-info">Jovens: ${igreja.qtdJovens ?? 0}</span>
              <span class="badge badge-info">Adultos: ${igreja.qtdAdultos ?? 0}</span>
            </div>
          </div>
          <div class="acoes">
            <button class="botao-icone icone-editar" data-editar-igreja="${igreja.id}" title="Editar" aria-label="Editar ${_escapar(igreja.nome)}">✏️</button>
            <button class="botao-icone icone-excluir" data-excluir-igreja="${igreja.id}" title="Excluir" aria-label="Excluir ${_escapar(igreja.nome)}">🗑️</button>
          </div>
        </div>`
      )
      .join("");

    container.querySelectorAll("[data-abrir-igreja], [data-editar-igreja]").forEach((el) => {
      el.addEventListener("click", () => this.abrirFormulario(el.dataset.abrirIgreja || el.dataset.editarIgreja));
    });

    container.querySelectorAll("[data-excluir-igreja]").forEach((el) => {
      el.addEventListener("click", (evento) => {
        evento.stopPropagation();
        this.excluir(el.dataset.excluirIgreja);
      });
    });
  },

  async excluir(idIgreja) {
    const igreja = this.lista.find((i) => i.id === idIgreja);
    const confirmar = confirm(`Excluir "${igreja?.nome || "esta igreja"}"? Isso não apaga o histórico já registrado.`);
    if (!confirmar) return;

    const resposta = await Api.remover("igrejas", idIgreja);
    if (resposta.sucesso) {
      UI.mostrarToast("Igreja excluída.");
      this.carregar();
    } else {
      UI.mostrarToast(resposta.erro || "Não foi possível excluir.");
    }
  },

  abrirFormulario(idIgreja = null) {
    const igreja = idIgreja ? this.lista.find((i) => i.id === idIgreja) : {};
    const html = `
      <h2>${idIgreja ? "Editar Igreja" : "Nova Igreja"}</h2>
      <form id="form-igreja">
        <div class="campo"><label>Nome</label><input name="nome" required value="${_escapar(igreja.nome)}"></div>
        <div class="campo"><label>Padroeiro</label><input name="padroeiro" value="${_escapar(igreja.padroeiro)}"></div>
        <div class="campo"><label>Comunidade</label><input name="comunidade" value="${_escapar(igreja.comunidade)}"></div>
        <div class="campo"><label>Endereço</label><input name="endereco" value="${_escapar(igreja.endereco)}"></div>
        <div class="campo"><label>Horários (ex.: Qui 19h, Dom 7h e 19h)</label><input name="horarios" value="${_escapar(igreja.horarios)}"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
          <div class="campo"><label>Casais</label><input type="number" min="0" name="qtdCasais" value="${igreja.qtdCasais ?? 0}"></div>
          <div class="campo"><label>Jovens</label><input type="number" min="0" name="qtdJovens" value="${igreja.qtdJovens ?? 0}"></div>
          <div class="campo"><label>Adultos</label><input type="number" min="0" name="qtdAdultos" value="${igreja.qtdAdultos ?? 0}"></div>
        </div>
        <div class="campo"><label>Observações</label><textarea name="observacoes" rows="2">${_escapar(igreja.observacoes)}</textarea></div>
        <button type="submit" class="botao botao-primario botao-bloco">Salvar</button>
      </form>
    `;
    UI.abrirModal(html);

    document.getElementById("form-igreja").addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const dados = Object.fromEntries(new FormData(evento.target).entries());
      if (idIgreja) dados.id = idIgreja;

      const resposta = idIgreja ? await Api.atualizar("igrejas", dados) : await Api.criar("igrejas", dados);
      if (resposta.sucesso) {
        UI.fecharModal();
        UI.mostrarToast("Igreja salva!");
        this.carregar();
      } else {
        UI.mostrarToast(resposta.erro || "Erro ao salvar.");
      }
    });
  },
};

document.getElementById("btn-nova-igreja")?.addEventListener("click", () => Churches.abrirFormulario());
