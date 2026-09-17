/* Cadastro de igrejas e celebrações recorrentes, sem horários em texto livre. */
const Churches = {
  lista: [],
  async carregar() {
    const container = document.getElementById("lista-admin-igrejas");
    container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Carregando...</p>`;
    const resposta = await Api.buscar("igrejas");
    if (!resposta.sucesso) return container.innerHTML = `<p style="color:var(--cor-alerta);">${_escapar(resposta.erro)}</p>`;
    this.lista = resposta.dados || []; this._renderizarLista();
  },
  _agenda(igreja) { try { const a = JSON.parse(igreja.celebracoes || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } },
  _renderizarLista() {
    const container = document.getElementById("lista-admin-igrejas");
    if (!this.lista.length) return container.innerHTML = `<p style="color:var(--cor-texto-secundario);">Nenhuma igreja cadastrada ainda. Toque em “+ Nova” para começar.</p>`;
    container.innerHTML = this.lista.map((igreja) => {
      const agenda = this._agenda(igreja); const resumo = agenda.length ? agenda.map((c) => `${_rotuloDia(c.diaChave)} ${c.horario}`).join(" · ") : (igreja.horarios || "Sem celebrações configuradas");
      return `<div class="item-admin entrada-item"><div class="info-principal" data-abrir-igreja="${igreja.id}"><strong>${_escapar(igreja.nome)}</strong><span>${_escapar(resumo)}</span><div class="badges-linha"><span class="badge badge-info">${agenda.length} celebração(ões)</span><span class="badge badge-aviso">Chegar ${igreja.minutosChegada ?? 30} min antes</span></div></div><div class="acoes"><button class="botao-icone icone-editar" data-editar-igreja="${igreja.id}" aria-label="Editar">✏️</button><button class="botao-icone icone-excluir" data-excluir-igreja="${igreja.id}" aria-label="Excluir">🗑️</button></div></div>`;
    }).join("");
    container.querySelectorAll("[data-abrir-igreja], [data-editar-igreja]").forEach((el) => el.addEventListener("click", () => this.abrirFormulario(el.dataset.abrirIgreja || el.dataset.editarIgreja)));
    container.querySelectorAll("[data-excluir-igreja]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); this.excluir(el.dataset.excluirIgreja); }));
  },
  async excluir(id) {
    const igreja = this.lista.find((i) => i.id === id); if (!confirm(`Excluir “${igreja?.nome || "esta igreja"}”? O histórico não será apagado.`)) return;
    const resposta = await Api.remover("igrejas", id); if (resposta.sucesso) { UI.mostrarToast("Igreja excluída."); this.carregar(); } else UI.mostrarToast(resposta.erro || "Não foi possível excluir.");
  },
  abrirFormulario(idIgreja = null) {
    const igreja = idIgreja ? this.lista.find((i) => i.id === idIgreja) : {}; const agenda = this._agenda(igreja);
    UI.abrirModal(`<h2>${idIgreja ? "Editar Igreja" : "Nova Igreja"}</h2><form id="form-igreja"><div class="campo"><label>Nome</label><input name="nome" required value="${_escapar(igreja.nome)}"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="campo"><label>Padroeiro</label><input name="padroeiro" value="${_escapar(igreja.padroeiro)}"></div><div class="campo"><label>Comunidade</label><input name="comunidade" value="${_escapar(igreja.comunidade)}"></div></div><div class="campo"><label>Endereço</label><input name="endereco" value="${_escapar(igreja.endereco)}"></div><div class="campo"><label>Chegar com quantos min. de antecedência</label><input type="number" min="0" step="5" name="minutosChegada" value="${igreja.minutosChegada ?? 30}"></div><div class="campo"><label>Celebrações regulares</label><p style="color:var(--cor-texto-secundario);font-size:var(--tamanho-xs);margin:4px 0 10px">Adicione cada missa com dia, hora e quantidade necessária. Datas específicas ficam em Eventos.</p><div id="linhas-celebracoes"></div><button type="button" class="botao botao-secundario" id="btn-adicionar-celebracao">+ Adicionar celebração</button></div><div class="campo"><label>Observações</label><textarea name="observacoes" rows="2">${_escapar(igreja.observacoes)}</textarea></div><button type="submit" class="botao botao-primario botao-bloco">Salvar</button></form>`);
    const linhas = document.getElementById("linhas-celebracoes");
    const adicionar = (c = {}) => { const linha = document.createElement("div"); linha.className = "card linha-celebracao"; linha.style.marginBottom = "8px"; linha.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="campo"><label>Dia</label><select data-dia><option value="quinta">Quinta-feira</option><option value="sabado">Sábado</option><option value="domingoManha">Domingo de manhã</option><option value="domingoNoite">Domingo à noite</option></select></div><div class="campo"><label>Hora</label><input type="time" data-hora required value="${_escapar(c.horario || "")}"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="campo"><label>Casais</label><input type="number" min="0" data-casais value="${c.qtdCasais ?? 0}"></div><div class="campo"><label>Jovens</label><input type="number" min="0" data-jovens value="${c.qtdJovens ?? 0}"></div></div><button type="button" class="botao botao-texto" data-remover>Remover celebração</button>`; linha.querySelector("[data-dia]").value = c.diaChave || "domingoNoite"; linha.querySelector("[data-remover]").addEventListener("click", () => linha.remove()); linhas.appendChild(linha); };
    agenda.forEach(adicionar); if (!agenda.length) adicionar(); document.getElementById("btn-adicionar-celebracao").addEventListener("click", () => adicionar());
    document.getElementById("form-igreja").addEventListener("submit", async (e) => { e.preventDefault(); const dados = Object.fromEntries(new FormData(e.target).entries()); const celebracoes = Array.from(linhas.querySelectorAll(".linha-celebracao")).map((l) => ({ diaChave: l.querySelector("[data-dia]").value, horario: l.querySelector("[data-hora]").value, qtdCasais: Number(l.querySelector("[data-casais]").value) || 0, qtdJovens: Number(l.querySelector("[data-jovens]").value) || 0 })).filter((c) => c.horario); if (!celebracoes.length) return UI.mostrarToast("Cadastre ao menos uma celebração com horário."); dados.celebracoes = JSON.stringify(celebracoes); if (idIgreja) dados.id = idIgreja; const resposta = idIgreja ? await Api.atualizar("igrejas", dados) : await Api.criar("igrejas", dados); if (resposta.sucesso) { UI.fecharModal(); UI.mostrarToast("Igreja salva!"); this.carregar(); } else UI.mostrarToast(resposta.erro || "Erro ao salvar."); });
  },
};
function _rotuloDia(chave) { return ({ quinta: "Qui", sabado: "Sáb", domingoManha: "Dom manhã", domingoNoite: "Dom noite" })[chave] || chave; }
document.getElementById("btn-nova-igreja")?.addEventListener("click", () => Churches.abrirFormulario());
