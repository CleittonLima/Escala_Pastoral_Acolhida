/* ==========================================================================
   scheduler.js
   Orquestra a GERAÇÃO AUTOMÁTICA DA ESCALA no front-end: dispara o cálculo
   no backend (Scheduler.gs, onde vive o algoritmo de pontuação documentado
   — ver appscript/Scheduler.gs), exibe o rascunho para revisão manual do
   coordenador, permite editar/duplicar/publicar/exportar.
   ========================================================================== */

const Scheduler = {
  rascunhoAtual: [],
  mesReferenciaAtual: null,

  async iniciarPainel() {
    const mesReferencia = _mesReferenciaAtual();
    this.mesReferenciaAtual = mesReferencia;

    document.getElementById("painel-gerar-escala").innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <p style="margin-bottom:12px;">Gerar escala para <strong>${_nomeMes(mesReferencia)}</strong>,
          com base na disponibilidade, histórico e critérios de rotatividade.</p>
        <button class="botao botao-primario botao-bloco" id="btn-gerar-agora">✨ Gerar Escala Automaticamente</button>
      </div>
      <div id="resultado-geracao"></div>
    `;

    document.getElementById("btn-gerar-agora").addEventListener("click", () => this.gerar());
  },

  async gerar() {
    const botao = document.getElementById("btn-gerar-agora");
    botao.disabled = true;
    botao.innerHTML = `<span class="icone-girando">⏳</span> Calculando pontuação de cada membro...`;

    const resposta = await Api.criar("escalas", {
      acao: "gerarAutomatica",
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
      container.innerHTML = `<p style="color:var(--cor-texto-secundario);">
        Nenhuma vaga pôde ser preenchida — verifique se há membros com disponibilidade cadastrada para este mês.
      </p>`;
      return;
    }

    container.innerHTML = `
      <h3 style="margin-bottom:10px;">Rascunho gerado — revise antes de publicar</h3>
      <p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm); margin-bottom:14px;">
        Toque em qualquer vaga para trocar manualmente o membro escalado.
      </p>
      <div id="lista-rascunho">
        ${this.rascunhoAtual
          .map(
            (vaga, i) => `
          <div class="item-escala entrada-item" style="animation-delay:${i * 30}ms" data-editar-vaga="${i}">
            <div class="data-bloco">
              <div class="dia">${(vaga.data || "").split("-")[2] || "--"}</div>
              <div class="mes">${_abrevMes(vaga.data)}</div>
            </div>
            <div class="info-principal">
              <strong>${_escapar(vaga.igrejaNome)} — ${_escapar(vaga.funcao)}</strong>
              <span>${_escapar(vaga.horario)} · ${vaga.membroNome ? _escapar(vaga.membroNome) : "⚠ Vaga em aberto"}</span>
            </div>
            <span class="badge ${vaga.membroNome ? "badge-sucesso" : "badge-alerta"}">${vaga.membroNome ? "OK" : "Vazio"}</span>
          </div>`
          )
          .join("")}
      </div>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="botao botao-secundario" id="btn-duplicar-escala" style="flex:1;">Duplicar</button>
        <button class="botao botao-primario" id="btn-publicar-escala" style="flex:1;">Publicar</button>
      </div>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button class="botao botao-texto" id="btn-imprimir-escala" style="flex:1;">🖨 Imprimir</button>
        <button class="botao botao-texto" id="btn-pdf-escala" style="flex:1;">📄 Gerar PDF</button>
        <button class="botao botao-texto" id="btn-compartilhar-escala" style="flex:1;">📤 Compartilhar</button>
      </div>
    `;

    container.querySelectorAll("[data-editar-vaga]").forEach((elemento) => {
      elemento.addEventListener("click", () => this._abrirTrocaManual(parseInt(elemento.dataset.editarVaga, 10)));
    });

    document.getElementById("btn-publicar-escala").addEventListener("click", () => this.publicar());
    document.getElementById("btn-duplicar-escala").addEventListener("click", () => this.duplicar());
    document.getElementById("btn-imprimir-escala").addEventListener("click", () => window.print());
    document.getElementById("btn-pdf-escala").addEventListener("click", () => this.gerarPDF());
    document.getElementById("btn-compartilhar-escala").addEventListener("click", () => this.compartilhar());
  },

  async _abrirTrocaManual(indice) {
    const vaga = this.rascunhoAtual[indice];
    const resposta = await Api.buscar("membros", { disponiveisPara: vaga.igrejaId, mesReferencia: this.mesReferenciaAtual });
    const opcoes = resposta.sucesso ? resposta.dados || [] : [];

    const html = `
      <h2>Escolher membro manualmente</h2>
      <p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm); margin-bottom:12px;">
        ${_escapar(vaga.igrejaNome)} — ${_escapar(vaga.funcao)} · ${_escapar(vaga.horario)}
      </p>
      <div style="display:flex; flex-direction:column; gap:8px; max-height:50vh; overflow-y:auto;">
        ${opcoes
          .map(
            (m) => `<button class="botao botao-secundario botao-bloco" data-escolher-membro="${m.id}" data-nome="${_escapar(m.nome)}">${_escapar(m.nome)}</button>`
          )
          .join("") || `<p style="color:var(--cor-texto-secundario);">Nenhum membro disponível encontrado.</p>`}
      </div>
    `;
    UI.abrirModal(html);

    document.querySelectorAll("[data-escolher-membro]").forEach((botao) => {
      botao.addEventListener("click", () => {
        this.rascunhoAtual[indice].membroId = botao.dataset.escolherMembro;
        this.rascunhoAtual[indice].membroNome = botao.dataset.nome;
        UI.fecharModal();
        this._renderizarRevisao();
      });
    });
  },

  async publicar() {
    const confirmar = confirm("Publicar esta escala? Os membros serão notificados e a disponibilidade deste mês ficará congelada.");
    if (!confirmar) return;

    const resposta = await Api.atualizar("escalas", {
      acao: "publicar",
      mesReferencia: this.mesReferenciaAtual,
      vagas: this.rascunhoAtual,
    });

    if (resposta.sucesso) {
      UI.mostrarToast("Escala publicada e membros notificados!");
    } else {
      UI.mostrarToast(resposta.erro || "Erro ao publicar.");
    }
  },

  async duplicar() {
    const resposta = await Api.criar("escalas", {
      acao: "duplicar",
      mesReferencia: this.mesReferenciaAtual,
      vagas: this.rascunhoAtual,
    });
    if (resposta.sucesso) UI.mostrarToast("Rascunho duplicado.");
  },

  gerarPDF() {
    // Usa a função de impressão do navegador com uma folha de estilo dedicada
    // a impressão (o service worker garante que o app shell já está disponível).
    UI.mostrarToast("Use a opção 'Salvar como PDF' na janela de impressão.");
    window.print();
  },

  async compartilhar() {
    const texto = this.rascunhoAtual
      .map((v) => `${v.data} ${v.horario} — ${v.igrejaNome} (${v.funcao}): ${v.membroNome || "vaga aberta"}`)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Escala Pastoral do Rosário", text: texto });
      } catch {
        /* usuário cancelou o compartilhamento */
      }
    } else {
      await navigator.clipboard.writeText(texto);
      UI.mostrarToast("Escala copiada — cole onde quiser compartilhar.");
    }
  },
};

function _abrevMes(dataISO) {
  const nomes = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const mes = parseInt((dataISO || "").split("-")[1], 10);
  return nomes[mes - 1] || "";
}
