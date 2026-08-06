/* ==========================================================================
   admin.js
   Funções exclusivas do Administrador: cadastro de membros (CRUD completo),
   histórico geral, relatórios e configurações do sistema (senha, backup,
   personalização de cores).
   ========================================================================== */

const Admin = {
  membros: [],

  /* ---- CADASTRO DE MEMBROS ---- */
  async carregarMembros() {
    const container = document.getElementById("lista-admin-membros");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;

    const resposta = await Api.buscar("membros");
    if (!resposta.sucesso) {
      container.innerHTML = `<p style="color:var(--cor-alerta);">${resposta.erro}</p>`;
      return;
    }
    this.membros = resposta.dados || [];
    this._renderizarMembros();
  },

  _renderizarMembros() {
    const container = document.getElementById("lista-admin-membros");
    if (this.membros.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhum membro cadastrado ainda.</p>`;
      return;
    }
    container.innerHTML = this.membros
      .map(
        (m) => `
        <div class="item-escala entrada-item" data-editar-membro="${m.id}">
          <div class="info-principal">
            <strong>${_escapar(m.nome)}</strong>
            <span>${_escapar(m.comunidade || "")} ${m.casado === "true" || m.casado === true ? "· Casado(a)" : ""}</span>
          </div>
          <span class="badge ${m.status === "Ativo" ? "badge-sucesso" : "badge-neutro"}">${_escapar(m.status)}</span>
        </div>`
      )
      .join("");

    container.querySelectorAll("[data-editar-membro]").forEach((el) => {
      el.addEventListener("click", () => this.abrirFormularioMembro(el.dataset.editarMembro));
    });
  },

  abrirFormularioMembro(idMembro = null) {
    const m = idMembro ? this.membros.find((x) => x.id === idMembro) : {};
    const html = `
      <h2>${idMembro ? "Editar Membro" : "Novo Membro"}</h2>
      <form id="form-membro">
        <div class="campo"><label>Nome</label><input name="nome" required value="${_escapar(m.nome)}"></div>
        <div class="campo"><label>Telefone</label><input name="telefone" required value="${_escapar(m.telefone)}"></div>
        <div class="campo"><label>WhatsApp</label><input name="whatsapp" value="${_escapar(m.whatsapp)}"></div>
        <div class="campo"><label>Email (opcional)</label><input type="email" name="email" value="${_escapar(m.email)}"></div>

        <div class="campo">
          <label>Casado(a)</label>
          <select name="casado" id="select-casado">
            <option value="false" ${!m.casado || m.casado === "false" ? "selected" : ""}>Não</option>
            <option value="true" ${m.casado === true || m.casado === "true" ? "selected" : ""}>Sim</option>
          </select>
        </div>
        <div class="campo" id="campo-conjuge" style="${m.casado === true || m.casado === "true" ? "" : "display:none;"}">
          <label>Nome do cônjuge</label><input name="nomeConjuge" value="${_escapar(m.nomeConjuge)}">
        </div>

        <div class="campo">
          <label>Participa de</label>
          <select name="participaDe">
            <option value="Nenhum" ${(!m.participaDe || m.participaDe === "Nenhum") ? "selected" : ""}>Nenhum</option>
            <option value="EJC" ${m.participaDe === "EJC" ? "selected" : ""}>EJC</option>
            <option value="ECC" ${m.participaDe === "ECC" ? "selected" : ""}>ECC</option>
            <option value="Outro" ${m.participaDe === "Outro" ? "selected" : ""}>Outro</option>
          </select>
        </div>

        <div class="campo"><label>Comunidade onde mora</label><input name="comunidade" value="${_escapar(m.comunidade)}"></div>

        <div class="campo">
          <label>Preferência para servir</label>
          <select name="preferenciaIgreja">
            ${CONFIG.IGREJAS_PADRAO.map((ig) => `<option value="${ig}" ${m.preferenciaIgreja === ig ? "selected" : ""}>${ig}</option>`).join("")}
          </select>
        </div>

        <div class="campo"><label>Observações permanentes</label><textarea name="observacoes" rows="2">${_escapar(m.observacoes)}</textarea></div>

        <div class="campo">
          <label>Status</label>
          <select name="status">
            <option value="Ativo" ${(!m.status || m.status === "Ativo") ? "selected" : ""}>Ativo</option>
            <option value="Inativo Temporariamente" ${m.status === "Inativo Temporariamente" ? "selected" : ""}>Inativo Temporariamente</option>
          </select>
        </div>

        <button type="submit" class="botao botao-primario botao-bloco">Salvar</button>
      </form>
    `;
    UI.abrirModal(html);

    document.getElementById("select-casado").addEventListener("change", (e) => {
      document.getElementById("campo-conjuge").style.display = e.target.value === "true" ? "" : "none";
    });

    document.getElementById("form-membro").addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const dados = Object.fromEntries(new FormData(evento.target).entries());
      if (idMembro) dados.id = idMembro;

      const resposta = idMembro ? await Api.atualizar("membros", dados) : await Api.criar("membros", dados);
      if (resposta.sucesso) {
        UI.fecharModal();
        UI.mostrarToast("Membro salvo!");
        this.carregarMembros();
      } else {
        UI.mostrarToast(resposta.erro || "Erro ao salvar.");
      }
    });
  },

  /* ---- HISTÓRICO GERAL ---- */
  async carregarHistoricoGeral() {
    const container = document.getElementById("lista-admin-historico");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;

    const resposta = await Api.buscar("historico");
    if (!resposta.sucesso || !resposta.dados || resposta.dados.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhum histórico registrado ainda.</p>`;
      return;
    }
    container.innerHTML = resposta.dados
      .map(
        (h) => `<div class="item-escala">
          <div class="info-principal">
            <strong>${_escapar(h.membroNome)} — ${_escapar(h.funcao)}</strong>
            <span>${_escapar(h.local)} · ${_escapar(h.data)} · ${_escapar(h.horario)}</span>
          </div>
          <span class="badge ${h.presenca ? "badge-sucesso" : "badge-neutro"}">${h.presenca ? "Presente" : "—"}</span>
        </div>`
      )
      .join("");
  },

  /* ---- RELATÓRIOS ---- */
  async carregarRelatorios() {
    const container = document.getElementById("painel-relatorios");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;

    const resposta = await Api.buscar("relatorios");
    if (!resposta.sucesso) {
      container.innerHTML = `<p style="color:var(--cor-alerta);">${resposta.erro}</p>`;
      return;
    }
    const r = resposta.dados;
    container.innerHTML = `
      <div class="card" style="margin-bottom:12px;">
        <h3>Participação por membro (últimos 6 meses)</h3>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
          ${(r.participacaoPorMembro || [])
            .map((p) => `<span style="font-size:var(--tamanho-sm);">${_escapar(p.nome)}: ${p.total} escalas</span>`)
            .join("")}
        </div>
      </div>
      <div class="card">
        <h3>Vagas em aberto no mês atual</h3>
        <p style="margin-top:6px; font-size:var(--tamanho-sm); color:var(--cor-texto-secundario);">${r.vagasEmAberto ?? 0} vaga(s) sem membro escalado</p>
      </div>
    `;
  },

  /* ---- CONFIGURAÇÕES DO SISTEMA ---- */
  async carregarConfigAdmin() {
    document.getElementById("painel-config-admin").innerHTML = `
      <div class="campo">
        <label>Nova senha de administrador</label>
        <input type="password" id="nova-senha-admin" placeholder="Deixe em branco para manter">
      </div>
      <button class="botao botao-primario botao-bloco" id="btn-salvar-senha" style="margin-bottom:20px;">Salvar Senha</button>

      <button class="botao botao-secundario botao-bloco" id="btn-backup-exportar-admin" style="margin-bottom:12px;">Exportar Backup Completo</button>
      <button class="botao botao-secundario botao-bloco" id="btn-backup-importar-admin" style="margin-bottom:20px;">Importar Backup</button>

      <button class="botao botao-texto botao-bloco" id="btn-sair-admin">Sair</button>
    `;

    document.getElementById("btn-salvar-senha").addEventListener("click", async () => {
      const novaSenha = document.getElementById("nova-senha-admin").value;
      if (!novaSenha) return UI.mostrarToast("Digite a nova senha.");
      const resposta = await Api.atualizar("configuracoes", { novaSenhaAdmin: novaSenha });
      UI.mostrarToast(resposta.sucesso ? "Senha atualizada!" : resposta.erro);
    });

    document.getElementById("btn-backup-exportar-admin").addEventListener("click", () => Admin.exportarBackup());
    document.getElementById("btn-sair-admin").addEventListener("click", () => Auth.sair());
  },

  async exportarBackup() {
    const resposta = await Api.buscar("configuracoes", { exportarBackup: true });
    if (!resposta.sucesso) return UI.mostrarToast(resposta.erro || "Erro ao exportar.");

    const blob = new Blob([JSON.stringify(resposta.dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-escala-rosario-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },
};

document.getElementById("btn-novo-membro")?.addEventListener("click", () => Admin.abrirFormularioMembro());
