/* ==========================================================================
   dashboard.js (app do Coordenador)
   Painel administrativo: estatísticas, alertas (igrejas sem horário,
   casais pendentes de vínculo), próximas escalas e próximos eventos.
   ========================================================================== */

const Dashboard = {
  async carregarPainelAdmin() {
    const grade  = document.getElementById("grade-dashboard-admin");
    const resumo = document.getElementById("admin-listas-resumo");
    grade.innerHTML  = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;
    resumo.innerHTML = "";

    const resposta = await Api.buscar("dashboard");
    if (!resposta.sucesso) {
      grade.innerHTML = `<p style="color:var(--cor-alerta);">${_escapar(resposta.erro)}</p>`;
      return;
    }

    const d = resposta.dados;

    // Alertas críticos no topo
    const alertas = [];
    if (d.igrejaSemHorario > 0) {
      alertas.push(`⚠ ${d.igrejaSemHorario} igreja(s) sem horário cadastrado — a escala automática não vai gerar vagas para elas.`);
    }

    grade.innerHTML = `
      ${alertas.map((a) => `
        <div style="grid-column:1/-1; background:rgba(178,59,59,0.12); border-left:4px solid var(--cor-alerta);
                    border-radius:var(--raio-md); padding:10px 14px; font-size:var(--tamanho-sm); color:var(--cor-alerta);">
          ${_escapar(a)}
        </div>`).join("")}
      <div class="cartao-stat"><div class="valor">${d.totalMembros ?? 0}</div><div class="rotulo">Membros</div></div>
      <div class="cartao-stat"><div class="valor">${d.totalCasais  ?? 0}</div><div class="rotulo">Casais</div></div>
      <div class="cartao-stat"><div class="valor">${d.totalJovens  ?? 0}</div><div class="rotulo">EJC</div></div>
      <div class="cartao-stat"><div class="valor">${d.totalIgrejas ?? 0}</div><div class="rotulo">Igrejas</div></div>
      <div class="cartao-stat"><div class="valor">${d.totalEventos ?? 0}</div><div class="rotulo">Eventos</div></div>
      <div class="cartao-stat"><div class="valor">${d.escalasEsteMs ?? 0}</div><div class="rotulo">Escalas no mês</div></div>
    `;

    resumo.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:10px;">Próximas Escalas</h3>
        ${_listaResumo(d.proximasEscalas, (e) => `${e.data} · ${e.igrejaNome} — ${e.membroNome || "vaga aberta"}`)}
      </div>
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:10px;">Próximos Eventos</h3>
        ${_listaResumo(d.proximosEventos, (e) => `${e.data} · ${e.nome}`)}
      </div>
      <div class="card">
        <h3 style="margin-bottom:10px;">Há mais tempo sem servir</h3>
        <p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-xs); margin-bottom:8px;">
          Lista interna para apoiar a distribuição justa — não é um ranking público.
        </p>
        ${_listaResumo(d.membrosSemServirRecente, (m) => `${m.nome} — ${m.diasSemServir} dias`)}
      </div>
    `;

    await Notifications.carregar();
  },
};

function _listaResumo(itens, formatador) {
  if (!itens || itens.length === 0) {
    return `<p style="color:var(--cor-texto-secundario); font-size:var(--tamanho-sm);">Nada por aqui no momento.</p>`;
  }
  return `<div style="display:flex; flex-direction:column; gap:6px;">
    ${itens.map((item) => `<span style="font-size:var(--tamanho-sm);">• ${_escapar(formatador(item))}</span>`).join("")}
  </div>`;
}
