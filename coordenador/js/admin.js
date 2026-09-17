/* ==========================================================================
   admin.js
   Funções exclusivas do Coordenador: cadastro de membros (CRUD completo
   com editar e excluir bem visíveis), múltipla pastoral, vínculo de
   casal/dupla do ECC, busca, histórico geral e relatórios.
   ========================================================================== */

const Admin = {
  membros: [],
  filtro: "",

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
    this._renderizarAvisoPendentes();
    this._renderizarMembros();
  },

  _renderizarAvisoPendentes() {
    const aviso = document.getElementById("aviso-pendentes-vinculo");
    const pendentes = this.membros.filter((m) => m.casalPendente === true && !m.vinculoConjugeId);

    if (pendentes.length === 0) {
      aviso.hidden = true;
      return;
    }
    aviso.hidden = false;
    aviso.innerHTML = `
      <div class="card" style="margin-bottom:16px; border-left:4px solid var(--cor-aviso);">
        <strong>${pendentes.length} membro(s) esperando vínculo de casal/dupla</strong>
        <p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm); margin-top:4px;">
          Eles se cadastraram sozinhos e marcaram ECC ou casado(a), mas ainda não vincularam o(a) parceiro(a).
          Toque no nome de cada um abaixo para vincular.
        </p>
      </div>
    `;
  },

  _renderizarMembros() {
    const container = document.getElementById("lista-admin-membros");
    const filtro = this.filtro.trim().toLowerCase();
    const listaFiltrada = filtro
      ? this.membros.filter((m) => (m.nome || "").toLowerCase().includes(filtro))
      : this.membros;

    if (this.membros.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhum membro cadastrado ainda. Toque em "+ Novo" para cadastrar o primeiro.</p>`;
      return;
    }
    if (listaFiltrada.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhum membro encontrado para "${_escapar(this.filtro)}".</p>`;
      return;
    }

    container.innerHTML = listaFiltrada
      .map((m) => {
        const pendente = m.casalPendente === true && !m.vinculoConjugeId;
        return `
        <div class="item-admin entrada-item">
          <div class="info-principal" data-abrir-membro="${m.id}">
            <strong>${_escapar(m.nome)}</strong>
            <span>${_escapar(m.comunidade || "Sem comunidade")}${m.participaDe && m.participaDe !== "Nenhum" ? " · " + _escapar(m.participaDe) : ""}</span>
            <div class="badges-linha">
              <span class="badge ${m.status === "Ativo" ? "badge-sucesso" : "badge-neutro"}">${_escapar(m.status)}</span>
              ${m.autoCadastro ? `<span class="badge badge-info">Autocadastro</span>` : ""}
              ${pendente ? `<span class="badge badge-aviso">Pendente de vínculo</span>` : ""}
            </div>
          </div>
          <div class="acoes">
            <button class="botao-icone icone-editar" data-editar-membro="${m.id}" title="Editar" aria-label="Editar ${_escapar(m.nome)}">✏️</button>
            <button class="botao-icone icone-excluir" data-excluir-membro="${m.id}" title="Excluir" aria-label="Excluir ${_escapar(m.nome)}">🗑️</button>
          </div>
        </div>`;
      })
      .join("");

    container.querySelectorAll("[data-abrir-membro], [data-editar-membro]").forEach((el) => {
      el.addEventListener("click", () => this.abrirFormularioMembro(el.dataset.abrirMembro || el.dataset.editarMembro));
    });

    container.querySelectorAll("[data-excluir-membro]").forEach((el) => {
      el.addEventListener("click", (evento) => {
        evento.stopPropagation();
        this.excluirMembro(el.dataset.excluirMembro);
      });
    });
  },

  async excluirMembro(idMembro) {
    const membro = this.membros.find((m) => m.id === idMembro);
    const confirmar = confirm(`Excluir "${membro?.nome || "este membro"}"? O histórico dele será mantido, mas ele deixará de aparecer nas escalas futuras.`);
    if (!confirmar) return;

    const resposta = await Api.remover("membros", idMembro);
    if (resposta.sucesso) {
      UI.mostrarToast("Membro excluído.");
      this.carregarMembros();
    } else {
      UI.mostrarToast(resposta.erro || "Não foi possível excluir.");
    }
  },

  abrirFormularioMembro(idMembro = null) {
    const m = idMembro ? this.membros.find((x) => x.id === idMembro) : {};
    const participacoesAtuais = (m.participaDe || "").split(",").map((p) => p.trim()).filter(Boolean);
    const ehCasadoOuEcc = m.casado === true || m.casado === "true" || participacoesAtuais.includes("ECC");

    const parceiroAtual = m.vinculoConjugeId ? this.membros.find((x) => x.id === m.vinculoConjugeId) : null;

    const html = `
      <h2>${idMembro ? "Editar Membro" : "Novo Membro"}</h2>
      <form id="form-membro">
        <div class="campo"><label>Nome</label><input name="nome" required value="${_escapar(m.nome)}"></div>
        <div class="campo"><label>Apelido (opcional)</label><input name="apelido" value="${_escapar(m.apelido)}"></div>
        <div class="campo"><label>Telefone</label><input name="telefone" id="campo-telefone-membro" required value="${_escapar(m.telefone)}"></div>
        <div class="campo"><label>WhatsApp</label><input name="whatsapp" id="campo-whatsapp-membro" value="${_escapar(m.whatsapp)}"></div>
        <div class="campo"><label>Email (opcional)</label><input type="email" name="email" value="${_escapar(m.email)}"></div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="campo"><label>Sexo</label><select name="sexo" required><option value="">Selecione</option><option value="Masculino" ${m.sexo === "Masculino" ? "selected" : ""}>Masculino</option><option value="Feminino" ${m.sexo === "Feminino" ? "selected" : ""}>Feminino</option></select></div>
          <div class="campo"><label>Categoria na escala</label><select name="categoriaServico"><option value="Jovem" ${m.categoriaServico === "Jovem" ? "selected" : ""}>Jovem solteiro(a)</option><option value="Adulto" ${m.categoriaServico === "Adulto" ? "selected" : ""}>Adulto solteiro(a)</option><option value="Casado" ${m.categoriaServico === "Casado" ? "selected" : ""}>Casado(a)</option></select></div>
        </div>

        <div class="campo">
          <label>Casado(a)</label>
          <select name="casado" id="select-casado">
            <option value="false" ${!m.casado || m.casado === "false" ? "selected" : ""}>Não</option>
            <option value="true" ${m.casado === true || m.casado === "true" ? "selected" : ""}>Sim</option>
          </select>
        </div>

        <div class="campo">
          <label>Participa de (marque quantas fizerem sentido)</label>
          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:4px;">
            ${CONFIG.OPCOES_PASTORAIS.map(
              (op) => `
              <label style="display:flex; align-items:center; gap:6px; font-weight:400; font-size:var(--tamanho-sm);">
                <input type="checkbox" name="participaDe" value="${op}" ${participacoesAtuais.includes(op) ? "checked" : ""}> ${op}
              </label>`
            ).join("")}
          </div>
        </div>

        <div class="campo" id="campo-vinculo-membro" style="${ehCasadoOuEcc ? "" : "display:none;"}">
          <label>Cônjuge / dupla do ECC</label>
          ${
            parceiroAtual
              ? `<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
                   <span>${_escapar(parceiroAtual.nome)}</span>
                   <button type="button" class="botao-icone icone-excluir" id="btn-desvincular-parceiro" title="Desvincular">🗑️</button>
                 </div>`
              : `<select id="select-parceiro-membro"><option value="">Carregando opções...</option></select>
                 <p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-xs); margin-top:4px;">
                   Se o(a) parceiro(a) ainda não tem conta, deixe em branco — ele(a) pode vincular ao se cadastrar,
                   ou você vincula aqui depois.
                 </p>`
          }
        </div>

        <div class="campo"><label>Comunidade onde mora</label><input name="comunidade" value="${_escapar(m.comunidade)}"></div>

        <div class="campo">
          <label>Preferência para servir</label>
          <select name="preferenciaIgreja">
            ${CONFIG.IGREJAS_PADRAO.map((ig) => `<option value="${ig}" ${m.preferenciaIgreja === ig ? "selected" : ""}>${ig}</option>`).join("")}
          </select>
        </div>

        <div class="campo"><label>Horários preferidos</label><div style="display:flex; flex-wrap:wrap; gap:10px;">${CONFIG.DIAS_DISPONIBILIDADE.map((dia) => `<label style="display:flex;align-items:center;gap:5px;font-weight:400;"><input type="checkbox" name="preferenciaHorarios" value="${dia.chave}" ${(m.preferenciaHorarios || "").split(",").includes(dia.chave) ? "checked" : ""}> ${dia.rotulo}</label>`).join("")}</div></div>

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

    Mascaras.telefone(document.getElementById("campo-telefone-membro"));
    Mascaras.telefone(document.getElementById("campo-whatsapp-membro"));

    const atualizarVisibilidadeVinculo = () => {
      const casado = document.getElementById("select-casado").value === "true";
      const participaEcc = Array.from(document.querySelectorAll('input[name="participaDe"]:checked')).some((c) => c.value === "ECC");
      document.getElementById("campo-vinculo-membro").style.display = casado || participaEcc ? "" : "none";
    };
    document.getElementById("select-casado").addEventListener("change", atualizarVisibilidadeVinculo);
    document.querySelectorAll('input[name="participaDe"]').forEach((c) => c.addEventListener("change", atualizarVisibilidadeVinculo));

    const selectParceiro = document.getElementById("select-parceiro-membro");
    if (selectParceiro) {
      const tipo = "Casado";
      const sexoDesejado = m.sexo === "Masculino" ? "Feminino" : m.sexo === "Feminino" ? "Masculino" : "";
      Api.buscar("membros", { pendentesDeVinculo: tipo, sexoDesejado }).then((resposta) => {
        const opcoes = (resposta.sucesso ? resposta.dados : []).filter((x) => x.id !== idMembro);
        selectParceiro.innerHTML =
          `<option value="">Ainda não vinculado</option>` +
          opcoes.map((x) => `<option value="${x.id}">${_escapar(x.nome)}</option>`).join("");
      });
    }

    document.getElementById("btn-desvincular-parceiro")?.addEventListener("click", async () => {
      const ok = confirm("Desvincular este casal/dupla?");
      if (!ok) return;
      await Api.atualizar("membros", { id: m.id, vinculoConjugeId: "" });
      if (parceiroAtual) await Api.atualizar("membros", { id: parceiroAtual.id, vinculoConjugeId: "" });
      UI.mostrarToast("Vínculo removido.");
      UI.fecharModal();
      this.carregarMembros();
    });

    document.getElementById("form-membro").addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const formData = new FormData(evento.target);
      const dados = Object.fromEntries(formData.entries());
      dados.participaDe = formData.getAll("participaDe").join(",") || "Nenhum";
      dados.preferenciaHorarios = formData.getAll("preferenciaHorarios").join(",");
      dados.casado = dados.categoriaServico === "Casado";
      if (idMembro) dados.id = idMembro;

      const idParceiroEscolhido = document.getElementById("select-parceiro-membro")?.value;

      const resposta = idMembro ? await Api.atualizar("membros", dados) : await Api.criar("membros", dados);
      if (!resposta.sucesso) {
        UI.mostrarToast(resposta.erro || "Erro ao salvar.");
        return;
      }

      const idSalvo = idMembro || resposta.dados.id;
      if (idParceiroEscolhido) {
        await Api.atualizar("membros", { acao: "vincularParceiros", id: idSalvo, idParceiro: idParceiroEscolhido });
      }

      UI.fecharModal();
      UI.mostrarToast("Membro salvo!");
      this.carregarMembros();
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
            .join("") || `<span style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm);">Sem dados ainda.</span>`}
        </div>
      </div>
      <div class="card">
        <h3>Vagas em aberto no mês atual</h3>
        <p style="margin-top:6px; font-size:var(--tamanho-sm); color:var(--cor-texto-secundario);">${r.vagasEmAberto ?? 0} vaga(s) sem membro escalado</p>
      </div>
    `;
  },

  /* ---- BACKUP ---- */
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

document.getElementById("busca-membros")?.addEventListener("input", (evento) => {
  Admin.filtro = evento.target.value;
  Admin._renderizarMembros();
});
