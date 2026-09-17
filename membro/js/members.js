/* ==========================================================================
   members.js
   Lógica da ÁREA DO MEMBRO: carregar próximas escalas, listar escalas
   pessoais, preencher disponibilidade mensal (com salvamento automático),
   ver histórico pessoal e editar o próprio perfil (nome/apelido).
   ========================================================================== */

const Members = {
  disponibilidadeAtual: {},
  _salvarDisponibilidadeComAtraso: null,

  /** Carrega os dados do painel inicial do membro (próxima escala). */
  async carregarPainelMembro() {
    const resposta = await Api.buscar("escalas", {
      membroId: Auth.membroLogado.id,
      somenteFuturas: true,
      limite: 1,
    });

    const container = document.getElementById("proxima-escala-membro");
    if (!resposta.sucesso || !resposta.dados || resposta.dados.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhuma escala futura encontrada.</p>`;
      return;
    }

    container.innerHTML = resposta.dados.map((e) => _htmlItemEscala(e)).join("");
    await Notifications.carregar();
  },

  /** Lista todas as escalas futuras e passadas do membro. */
  async carregarMinhasEscalas() {
    const container = document.getElementById("lista-minhas-escalas");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;

    const resposta = await Api.buscar("escalas", { membroId: Auth.membroLogado.id });
    if (!resposta.sucesso) {
      container.innerHTML = `<p style="color:var(--cor-alerta);">${resposta.erro}</p>`;
      return;
    }
    if (!resposta.dados || resposta.dados.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Você ainda não possui escalas.</p>`;
      return;
    }
    container.innerHTML = resposta.dados.map((e, i) => _htmlItemEscala(e, i)).join("");
  },

  /* ---- Disponibilidade mensal (com salvamento automático) ---- */

  async carregarDisponibilidade() {
    const mesReferencia = _mesReferenciaAtual();
    document.getElementById("periodo-disponibilidade").textContent =
      `Referente a ${_nomeMes(mesReferencia)} — preencha até o dia 20`;

    const container = document.getElementById("lista-disponibilidade");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;

    const resposta = await Api.buscar("disponibilidade", {
      membroId: Auth.membroLogado.id,
      mesReferencia,
    });

    const dadosSalvos = resposta.sucesso && resposta.dados && Object.keys(resposta.dados).length
      ? resposta.dados : { quinta: true, sabado: true, domingoManha: true, domingoNoite: true };
    this.disponibilidadeAtual = { ...dadosSalvos };

    const congelada = dadosSalvos.congelada === true;

    container.innerHTML = CONFIG.DIAS_DISPONIBILIDADE.map((dia) => {
      const selecionado = dadosSalvos[dia.chave] === true;
      return `
        <div class="chip-disponibilidade ${selecionado ? "selecionado" : ""}" data-dia="${dia.chave}"
             style="${congelada ? "pointer-events:none; opacity:0.6;" : ""}">
          <span>${dia.rotulo}</span>
          <label class="interruptor">
            <input type="checkbox" data-toggle-dia="${dia.chave}" ${selecionado ? "checked" : ""} ${congelada ? "disabled" : ""}>
            <span class="trilho"></span>
          </label>
        </div>`;
    }).join("");

    document.getElementById("obs-mes").value = dadosSalvos.observacoesMes || "";
    document.getElementById("obs-mes").disabled = congelada;

    const status = document.getElementById("disponibilidade-status");
    if (status) status.textContent = "";

    if (congelada) {
      container.insertAdjacentHTML(
        "beforeend",
        `<p style="color:var(--cor-aviso); font-size:var(--tamanho-sm); margin-top:8px;">
           A escala deste mês já foi publicada — alterações valem a partir do próximo mês.
         </p>`
      );
      return;
    }

    container.querySelectorAll(".chip-disponibilidade").forEach((chip) => {
      chip.addEventListener("click", (evento) => {
        if (evento.target.matches("input")) return; // o próprio checkbox já dispara
        const checkbox = chip.querySelector("input");
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
      });
    });

    container.querySelectorAll("[data-toggle-dia]").forEach((input) => {
      input.addEventListener("change", (evento) => {
        const chave = evento.target.dataset.toggleDia;
        this.disponibilidadeAtual[chave] = evento.target.checked;
        evento.target.closest(".chip-disponibilidade").classList.toggle("selecionado", evento.target.checked);
        // Salva na hora — cada toque já fica gravado, mesmo que o app
        // seja fechado ou recarregue antes de você mexer em outra coisa.
        this.salvarDisponibilidade({ silencioso: true });
      });
    });
  },

  /**
   * Salva a disponibilidade. Por padrão mostra um toast; passe
   * `{silencioso:true}` para salvar em segundo plano (autosave), só
   * atualizando um textinho discreto de status.
   */
  async salvarDisponibilidade(opcoes = {}) {
    const { silencioso = false } = opcoes;
    const mesReferencia = _mesReferenciaAtual();
    const dados = {
      membroId: Auth.membroLogado.id,
      mesReferencia,
      observacoesMes: document.getElementById("obs-mes").value.trim(),
      ...this.disponibilidadeAtual,
    };

    const status = document.getElementById("disponibilidade-status");
    if (silencioso && status) status.textContent = "Salvando...";

    const resposta = await Api.atualizar("disponibilidade", dados);

    if (resposta.sucesso) {
      if (silencioso && status) {
        const agora = new Date();
        status.textContent = `Salvo automaticamente às ${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
      } else if (!silencioso) {
        UI.mostrarToast("Disponibilidade salva!");
      }
    } else if (!silencioso) {
      UI.mostrarToast(resposta.erro || "Não foi possível salvar.");
    }
  },

  async carregarHistoricoPessoal() {
    const container = document.getElementById("lista-historico-membro");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;

    const resposta = await Api.buscar("historico", { membroId: Auth.membroLogado.id });
    if (!resposta.sucesso || !resposta.dados || resposta.dados.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhum registro de participação ainda.</p>`;
      return;
    }

    container.innerHTML = resposta.dados
      .map(
        (h) => `
        <div class="item-escala">
          <div class="info-principal">
            <strong>${_escapar(h.local)} — ${_escapar(h.funcao)}</strong>
            <span>${_escapar(h.data)} · ${_escapar(h.horario)}${h.evento ? " · " + _escapar(h.evento) : ""}</span>
          </div>
          <span class="badge ${h.presenca ? "badge-sucesso" : "badge-neutro"}">${h.presenca ? "Presente" : "—"}</span>
        </div>`
      )
      .join("");
  },

  /* ---- Perfil (nome / apelido) ---- */

  async carregarPerfil() {
    document.getElementById("ajustes-nome").value = Auth.membroLogado.nome || "";
    document.getElementById("ajustes-apelido").value = Auth.membroLogado.apelido || "";
    const selectIgreja = document.getElementById("ajustes-preferencia-igreja");
    const resIgrejas = await Api.buscar("igrejas");
    const igrejas = resIgrejas.sucesso ? resIgrejas.dados || [] : [];
    const preferida = Auth.membroLogado.preferenciaIgreja || "Sem preferência";
    selectIgreja.innerHTML = `<option value="Sem preferência">Sem preferência</option>` + igrejas.map((i) =>
      `<option value="${_escapar(i.nome)}" ${i.nome === preferida ? "selected" : ""}>${_escapar(i.nome)}</option>`).join("");
    const horarios = (Auth.membroLogado.preferenciaHorarios || "").split(",");
    document.getElementById("ajustes-preferencia-horarios").innerHTML = CONFIG.DIAS_DISPONIBILIDADE.map((d) =>
      `<label style="display:flex;gap:5px;align-items:center;font-weight:400;"><input type="checkbox" name="ajuste-horario" value="${d.chave}" ${horarios.includes(d.chave) ? "checked" : ""}> ${d.rotulo}</label>`).join("");
  },

  async salvarPerfil() {
    const nome = document.getElementById("ajustes-nome").value.trim();
    const apelido = document.getElementById("ajustes-apelido").value.trim();
    const preferenciaIgreja = document.getElementById("ajustes-preferencia-igreja").value;
    const preferenciaHorarios = Array.from(document.querySelectorAll('input[name="ajuste-horario"]:checked')).map((x) => x.value).join(",");
    if (!nome) return UI.mostrarToast("O nome não pode ficar vazio.");

    const botao = document.getElementById("btn-salvar-perfil");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const resposta = await Api.atualizar("membros", { id: Auth.membroLogado.id, nome, apelido, preferenciaIgreja, preferenciaHorarios });

    botao.disabled = false;
    botao.textContent = "Salvar Perfil";

    if (resposta.sucesso) {
      Auth.membroLogado.nome = nome;
      Auth.membroLogado.apelido = apelido;
      Auth.membroLogado.preferenciaIgreja = preferenciaIgreja;
      Auth.membroLogado.preferenciaHorarios = preferenciaHorarios;
      UI.mostrarToast("Perfil atualizado!");
    } else {
      UI.mostrarToast(resposta.erro || "Não foi possível salvar.");
    }
  },
};

function _htmlItemEscala(escala, indice = 0) {
  const [ano, mes, dia] = (escala.data || "").split("-");
  const nomesMes = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  return `
    <div class="item-escala entrada-item" style="animation-delay:${indice * 40}ms">
      <div class="data-bloco">
        <div class="dia">${dia || "--"}</div>
        <div class="mes">${mes ? nomesMes[parseInt(mes, 10) - 1] : ""}</div>
      </div>
      <div class="info-principal">
        <strong>${_escapar(escala.igrejaNome || escala.local)} — ${_escapar(escala.funcao)}</strong>
        <span>${_escapar(escala.horario)}${escala.eventoNome ? " · " + _escapar(escala.eventoNome) : ""}</span>
      </div>
      <span class="badge ${escala.status === "publicada" ? "badge-sucesso" : "badge-aviso"}">
        ${escala.status === "publicada" ? "Confirmada" : "Rascunho"}
      </span>
    </div>`;
}

document.getElementById("obs-mes")?.addEventListener(
  "input",
  debounce(() => Members.salvarDisponibilidade({ silencioso: true }), 900)
);
