/* ==========================================================================
   scheduler.js (app do Coordenador)
   Painel de geração automática de escalas: dispara o cálculo no backend,
   exibe o rascunho para revisão manual (com troca de membro filtrada
   pelo dia correto), permite definir prioridades manuais e publicar.
   ========================================================================== */

const Scheduler = {
  rascunhoAtual:      [],
  mesReferenciaAtual: null,
  igrejasSemHorario:  [],

  async iniciarPainel() {
    const mesReferencia = _mesReferenciaAtual();
    this.mesReferenciaAtual = mesReferencia;

    // Checar igrejas sem horário cadastrado (causariam vagas zeradas)
    const resIgrejas = await Api.buscar("igrejas");
    this.igrejasSemHorario = resIgrejas.sucesso
      ? (resIgrejas.dados || []).filter((i) => !i.horarios)
      : [];

    const avisoHorario = this.igrejasSemHorario.length > 0
      ? `<div class="card" style="margin-bottom:14px; border-left:4px solid var(--cor-aviso);">
           <strong>⚠ ${this.igrejasSemHorario.length} igreja(s) sem horário definido</strong>
           <p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm); margin-top:4px;">
             ${this.igrejasSemHorario.map((i) => i.nome).join(", ")} — sem horário cadastrado, nenhuma vaga será criada
             para ela(s) na geração automática. <a href="javascript:void(0)" data-navegar="tela-admin-igrejas"
             style="color:var(--cor-primaria);">Cadastrar horários →</a>
           </p>
         </div>`
      : "";

    document.getElementById("painel-gerar-escala").innerHTML = `
      ${avisoHorario}
      <div class="card" style="margin-bottom:16px;">
        <p style="margin-bottom:12px;">Gerar escala para <strong>${_nomeMes(mesReferencia)}</strong>.</p>
        <button class="botao botao-primario botao-bloco" id="btn-gerar-agora">✨ Gerar Escala Automaticamente</button>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:8px;">Prioridade Manual</h3>
        <p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm); margin-bottom:10px;">
          Marque membros que devem ter preferência este mês (+40 pontos no algoritmo).
        </p>
        <div id="lista-prioridades"></div>
      </div>

      <div id="resultado-geracao"></div>
    `;

    document.getElementById("btn-gerar-agora")
      .addEventListener("click", () => this.gerar());

    this._carregarPrioridades();
  },

  async _carregarPrioridades() {
    const [resMembros, resPrior] = await Promise.all([
      Api.buscar("membros"),
      Api.buscar("prioridades", { mesReferencia: this.mesReferenciaAtual }),
    ]);

    const membros    = resMembros.sucesso  ? (resMembros.dados  || []) : [];
    const prioridades = resPrior.sucesso  ? (resPrior.dados    || []) : [];
    const idsPrior   = new Set(prioridades.map((p) => p.membroId));

    const container = document.getElementById("lista-prioridades");
    if (membros.length === 0) {
      container.innerHTML = `<p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm);">Nenhum membro cadastrado.</p>`;
      return;
    }

    container.innerHTML = membros
      .filter((m) => m.status === "Ativo")
      .map((m) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--cor-borda);">
          <span style="font-size:var(--tamanho-sm);">${_escapar(m.nome)}</span>
          <label class="interruptor">
            <input type="checkbox" data-prioridade-membro="${m.id}" ${idsPrior.has(m.id) ? "checked" : ""}>
            <span class="trilho"></span>
          </label>
        </div>`)
      .join("");

    container.querySelectorAll("[data-prioridade-membro]").forEach((input) => {
      input.addEventListener("change", async (ev) => {
        await Api.atualizar("prioridades", {
          membroId:       ev.target.dataset.prioridadeMembro,
          mesReferencia:  this.mesReferenciaAtual,
          ativo:          ev.target.checked,
        });
      });
    });
  },

  async gerar() {
    const botao = document.getElementById("btn-gerar-agora");
    botao.disabled = true;
    botao.innerHTML = `<span class="icone-girando">⏳</span> Calculando pontuação...`;

    const resposta = await Api.criar("escalas", {
      acao:          "gerarAutomatica",
      mesReferencia: this.mesReferenciaAtual,
    });

    botao.disabled = false;
    botao.textContent = "✨ Gerar Escala Automaticamente";

    if (!resposta.sucesso) {
      UI.mostrarToast(resposta.erro || "Não foi possível gerar a escala.");
      return;
    }

    this.rascunhoAtual = resposta.dados || [];
    this._renderizarRevisao();
  },

  _renderizarRevisao() {
    const container = document.getElementById("resultado-geracao");

    if (this.rascunhoAtual.length === 0) {
      container.innerHTML = `
        <div class="card">
          <p style="color:var(--cor-texto-secundario);">
            Nenhuma vaga foi gerada. Verifique se há:<br>
            • Igrejas com horários cadastrados<br>
            • Membros com disponibilidade preenchida para este mês
          </p>
        </div>`;
      return;
    }

    const vagasSemMembro = this.rascunhoAtual.filter((v) => !v.membroId).length;
    const avisoAbertos = vagasSemMembro > 0
      ? `<p style="color:var(--cor-aviso); font-size:var(--tamanho-sm); margin-bottom:10px;">
           ⚠ ${vagasSemMembro} vaga(s) sem membro disponível — toque para preencher manualmente.
         </p>` : "";

    container.innerHTML = `
      <h3 style="margin-bottom:8px;">Rascunho — revise antes de publicar</h3>
      ${avisoAbertos}
      <div id="lista-rascunho">
        ${this.rascunhoAtual.map((vaga, i) => `
          <div class="item-escala entrada-item" style="animation-delay:${i * 25}ms; cursor:pointer;"
               data-editar-vaga="${i}">
            <div class="data-bloco">
              <div class="dia">${(vaga.data || "").split("-")[2] || "--"}</div>
              <div class="mes">${_abrevMes(vaga.data)}</div>
            </div>
            <div class="info-principal">
              <strong>${_escapar(vaga.igrejaNome)} — ${_escapar(vaga.funcao)}</strong>
              <span>${_escapar(vaga.horario)}${vaga.eventoNome ? " · " + _escapar(vaga.eventoNome) : ""}</span>
              <span style="color:${vaga.membroNome ? "var(--cor-texto)" : "var(--cor-alerta)"};">
                ${vaga.membroNome ? _escapar(vaga.membroNome) : "⚠ Vaga em aberto"}
              </span>
            </div>
            <span class="badge ${vaga.membroNome ? "badge-sucesso" : "badge-alerta"}">
              ${vaga.membroNome ? "OK" : "Vazio"}
            </span>
          </div>`
        ).join("")}
      </div>
      <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
        <button class="botao botao-secundario" id="btn-duplicar-escala" style="flex:1; min-width:120px;">Salvar rascunho</button>
        <button class="botao botao-primario"   id="btn-publicar-escala" style="flex:1; min-width:120px;">Publicar</button>
      </div>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button class="botao botao-texto" id="btn-imprimir-escala"    style="flex:1;">🖨 Imprimir</button>
        <button class="botao botao-texto" id="btn-compartilhar-escala" style="flex:1;">📤 Compartilhar</button>
      </div>
    `;

    document.querySelectorAll("[data-editar-vaga]").forEach((el) => {
      el.addEventListener("click", () => this._abrirTrocaManual(parseInt(el.dataset.editarVaga, 10)));
    });

    document.getElementById("btn-publicar-escala")  .addEventListener("click", () => this.publicar());
    document.getElementById("btn-duplicar-escala")  .addEventListener("click", () => this.salvarRascunho());
    document.getElementById("btn-imprimir-escala")  .addEventListener("click", () => window.print());
    document.getElementById("btn-compartilhar-escala").addEventListener("click", () => this.compartilhar());
  },

  async _abrirTrocaManual(indice) {
    const vaga = this.rascunhoAtual[indice];

    // Busca membros disponíveis ESPECIFICAMENTE naquele dia da semana (não "qualquer disponível do mês")
    const resDisp = await Api.buscar("disponibilidade", {
      membroId:       "todos",         // backend retorna todos para o coordenador
      mesReferencia:  this.mesReferenciaAtual,
    });

    // fallback: busca todos os membros ativos
    const resMembros = await Api.buscar("membros");
    const todosMembros = resMembros.sucesso ? (resMembros.dados || []) : [];

    // Filtra por disponibilidade real no dia desta vaga
    const data = new Date(vaga.data + "T12:00:00");
    const diaSemana = data.getDay(); // 0=dom, 4=qui, 6=sab
    const diaChave = vaga.diaSemanaChave || (
      diaSemana === 4 ? "quinta" : diaSemana === 6 ? "sabado" :
      vaga.horario && /manha|manhã/i.test(vaga.horario) ? "domingoManha" : "domingoNoite"
    );

    const disponibilidades = resDisp.sucesso && Array.isArray(resDisp.dados)
      ? resDisp.dados : [];
    const idDisponiveisNoDia = new Set(
      disponibilidades
        .filter((d) => d.mesReferencia === this.mesReferenciaAtual && (d[diaChave] === true || d[diaChave] === "true"))
        .map((d) => d.membroId)
    );

    const candidatos = todosMembros.filter(
      (m) => m.status === "Ativo" && (idDisponiveisNoDia.has(m.id) || vaga.diaSemanaChave === "evento")
    );
    const porId = Object.fromEntries(candidatos.map((m) => [m.id, m]));
    const casalIds = new Set();
    const casais = candidatos.flatMap((m) => {
      const p = porId[m.vinculoConjugeId];
      if (!p || casalIds.has(m.id) || casalIds.has(p.id) || !(m.casado === true || m.casado === "true") || p.vinculoConjugeId !== m.id) return [];
      casalIds.add(m.id); casalIds.add(p.id);
      return [{ ids: `${m.id},${p.id}`, nome: `${m.nome} + ${p.nome}` }];
    });
    const solteiros = candidatos.filter((m) => !casalIds.has(m.id) && !(m.casado === true || m.casado === "true"));

    const html = `
      <h2>Escolher manualmente</h2>
      <p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm); margin-bottom:12px;">
        ${_escapar(vaga.igrejaNome)} — ${_escapar(vaga.funcao)} · ${_escapar(vaga.horario)} · ${_escapar(vaga.data)}
      </p>
      <button class="botao botao-texto botao-bloco" data-escolher-membro="" data-nome="(vaga em aberto)" style="margin-bottom:8px; color:var(--cor-alerta);">
        Deixar em aberto
      </button>
      <div style="max-height:50vh; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
        ${candidatos.length === 0
          ? `<p style="color:var(--cor-texto-secundario);">Nenhum membro disponível neste dia. Você ainda pode escolher qualquer um abaixo — mas eles não marcaram disponibilidade.</p>`
          : ""}
        ${casais.length ? `<strong style="font-size:var(--tamanho-sm);">Casais</strong>${casais.map((c) => `<button class="botao botao-secundario botao-bloco" data-escolher-membro="${c.ids}" data-nome="${_escapar(c.nome)}">${_escapar(c.nome)} ✓</button>`).join("")}` : ""}
        <strong style="font-size:var(--tamanho-sm); margin-top:8px;">Membros solteiros</strong>
        ${solteiros.map((m) => vaga.funcao === "Casal" ? `<label class="botao botao-texto" style="text-align:left;"><input type="checkbox" data-jovem-troca="${m.id}" data-nome="${_escapar(m.nome)}" data-sexo="${m.sexo || ""}"> ${_escapar(m.nome)} (Jovem)</label>` : `<button class="botao botao-secundario botao-bloco" data-escolher-membro="${m.id}" data-nome="${_escapar(m.nome)}">${_escapar(m.nome)} ✓</button>`).join("")}
        ${vaga.funcao === "Casal" ? `<button class="botao botao-primario botao-bloco" id="btn-confirmar-dois-jovens">Usar os 2 jovens selecionados</button>` : ""}
      </div>
    `;
    UI.abrirModal(html);

    document.querySelectorAll("[data-escolher-membro]").forEach((botao) => {
      botao.addEventListener("click", () => {
        this.rascunhoAtual[indice].membroIds  = botao.dataset.escolherMembro;
        this.rascunhoAtual[indice].membroId   = (botao.dataset.escolherMembro || "").split(",")[0] || "";
        this.rascunhoAtual[indice].membroNome = botao.dataset.nome === "(vaga em aberto)" ? "" : botao.dataset.nome;
        UI.fecharModal();
        this._renderizarRevisao();
      });
    });
    document.getElementById("btn-confirmar-dois-jovens")?.addEventListener("click", () => {
      const selecionados = Array.from(document.querySelectorAll("[data-jovem-troca]:checked"));
      if (selecionados.length !== 2 || new Set(selecionados.map((x) => x.dataset.sexo)).size !== 2) {
        return UI.mostrarToast("Selecione exatamente dois jovens: um homem e uma mulher.");
      }
      this.rascunhoAtual[indice].membroIds = selecionados.map((x) => x.dataset.jovemTroca).join(",");
      this.rascunhoAtual[indice].membroId = selecionados[0].dataset.jovemTroca;
      this.rascunhoAtual[indice].membroNome = selecionados.map((x) => x.dataset.nome).join(" + ");
      this.rascunhoAtual[indice].tipoUnidade = "Dois jovens";
      UI.fecharModal(); this._renderizarRevisao();
    });
  },

  async publicar() {
    if (!confirm("Publicar esta escala? Os membros serão notificados e a disponibilidade deste mês ficará congelada.")) return;
    const resposta = await Api.atualizar("escalas", {
      acao:          "publicar",
      mesReferencia: this.mesReferenciaAtual,
      vagas:         this.rascunhoAtual,
    });
    UI.mostrarToast(resposta.sucesso
      ? `✅ Escala publicada! ${resposta.dados?.quantidade ?? ""} membros notificados.`
      : resposta.erro || "Erro ao publicar."
    );
    if (resposta.sucesso) this.rascunhoAtual = [];
  },

  async salvarRascunho() {
    // Salva como escalas com status "rascunho" — não notifica membros
    const resposta = await Api.criar("escalas", {
      acao:          "duplicar",
      mesReferencia: this.mesReferenciaAtual,
      vagas:         this.rascunhoAtual,
    });
    UI.mostrarToast(resposta.sucesso ? "Rascunho salvo!" : "Erro ao salvar.");
  },

  async compartilhar() {
    const texto = this.rascunhoAtual
      .map((v) => `${v.data} ${v.horario} — ${v.igrejaNome} (${v.funcao}): ${v.membroNome || "vaga aberta"}`)
      .join("\n");

    if (navigator.share) {
      try { await navigator.share({ title: "Escala Pastoral do Rosário", text: texto }); } catch {}
    } else {
      await navigator.clipboard.writeText(texto);
      UI.mostrarToast("Escala copiada!");
    }
  },
};

function _abrevMes(dataISO) {
  const nomes = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const mes = parseInt((dataISO || "").split("-")[1], 10);
  return nomes[mes - 1] || "";
}
