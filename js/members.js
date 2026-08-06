/* ==========================================================================
   members.js
   Lógica da ÁREA DO MEMBRO: carregar próximas escalas, listar escalas
   pessoais, preencher disponibilidade mensal e ver histórico pessoal.
   (O CADASTRO de membros pelo admin fica em admin.js.)
   ========================================================================== */

const Members = {
  disponibilidadeAtual: {},

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

  /** Carrega a tela de disponibilidade mensal (chips + observações). */
  async carregarDisponibilidade() {
    const mesReferencia = _mesReferenciaAtual();
    document.getElementById("periodo-disponibilidade").textContent =
      `Referente a ${_nomeMes(mesReferencia)} — preencha até o dia 20`;

    const resposta = await Api.buscar("disponibilidade", {
      membroId: Auth.membroLogado.id,
      mesReferencia,
    });

    const dadosSalvos = resposta.sucesso && resposta.dados ? resposta.dados : {};
    this.disponibilidadeAtual = { ...dadosSalvos };

    const congelada = dadosSalvos.congelada === true;
    const container = document.getElementById("lista-disponibilidade");

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
    document.getElementById("btn-salvar-disponibilidade").hidden = congelada;

    if (congelada) {
      container.insertAdjacentHTML(
        "beforeend",
        `<p style="color:var(--cor-aviso); font-size:var(--tamanho-sm); margin-top:8px;">
           A escala deste mês já foi publicada — alterações valem a partir do próximo mês.
         </p>`
      );
    }

    container.querySelectorAll(".chip-disponibilidade").forEach((chip) => {
      chip.addEventListener("click", (evento) => {
        if (congelada) return;
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
      });
    });
  },

  async salvarDisponibilidade() {
    const mesReferencia = _mesReferenciaAtual();
    const dados = {
      membroId: Auth.membroLogado.id,
      mesReferencia,
      observacoesMes: document.getElementById("obs-mes").value.trim(),
      ...this.disponibilidadeAtual,
    };

    const botao = document.getElementById("btn-salvar-disponibilidade");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const resposta = await Api.atualizar("disponibilidade", dados);

    botao.disabled = false;
    botao.textContent = "Salvar Disponibilidade";

    if (resposta.sucesso) {
      UI.mostrarToast("Disponibilidade salva!");
    } else {
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

function _mesReferenciaAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

function _nomeMes(mesReferencia) {
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const [ano, mes] = mesReferencia.split("-");
  return `${nomes[parseInt(mes, 10) - 1]} de ${ano}`;
}

document.getElementById("btn-salvar-disponibilidade")?.addEventListener("click", () => Members.salvarDisponibilidade());
