/* ==========================================================================
   cadastro.js (app do Membro)
   Permite que o próprio membro crie sua conta: nome, telefone, e — só se
   for casado(a) ou fizer parte de um casal do ECC — a opção de vincular
   ao parceiro já cadastrado (ou deixar pendente, para o parceiro vincular
   depois, ou para o coordenador vincular manualmente).
   ========================================================================== */

const Cadastro = {
  candidatosVinculo: [],

  async iniciar() {
    document.getElementById("cadastro-nome").value = "";
    document.getElementById("cadastro-apelido").value = "";
    document.getElementById("cadastro-telefone").value = "";
    document.getElementById("cadastro-sexo").value = "";
    document.getElementById("cadastro-categoria").value = "Jovem";
    const selectIgreja = document.getElementById("cadastro-preferencia-igreja");
    const resIgrejas = await Api.buscar("igrejas");
    const igrejas = resIgrejas.sucesso ? resIgrejas.dados || [] : [];
    selectIgreja.innerHTML = `<option value="Sem preferência">Sem preferência</option>` + igrejas.map((i) =>
      `<option value="${i.nome}">${i.nome}</option>`).join("");
    document.getElementById("opcoes-pastorais-cadastro").innerHTML = CONFIG.OPCOES_PASTORAIS.map((op) =>
      `<label style="display:flex; gap:5px; align-items:center; font-weight:400;"><input type="checkbox" name="cadastro-pastoral" value="${op}"> ${op}</label>`).join("");
    document.getElementById("opcoes-horarios-cadastro").innerHTML = CONFIG.DIAS_DISPONIBILIDADE.map((dia) =>
      `<label style="display:flex; gap:5px; align-items:center; font-weight:400;"><input type="checkbox" name="cadastro-horario" value="${dia.chave}"> ${dia.rotulo}</label>`).join("");
    document.getElementById("campo-vincular-parceiro").hidden = true;
  },

  async _carregarCandidatosVinculo() {
    const select = document.getElementById("cadastro-parceiro");
    select.innerHTML = `<option value="">Meu(minha) parceiro(a) ainda não criou a conta</option>`;

    const sexo = document.getElementById("cadastro-sexo").value;
    const sexoDesejado = sexo === "Masculino" ? "Feminino" : sexo === "Feminino" ? "Masculino" : "";
    const resposta = await Api.buscar("membros", { pendentesDeVinculo: "Casado", sexoDesejado });
    if (resposta.sucesso && resposta.dados) {
      this.candidatosVinculo = resposta.dados;
      resposta.dados.forEach((m) => {
        const opcao = document.createElement("option");
        opcao.value = m.id;
        opcao.textContent = m.nome;
        select.appendChild(opcao);
      });
    }
  },
};

document.getElementById("cadastro-categoria")?.addEventListener("change", (evento) => {
    const tipo = evento.target.value;
    const campoVinculo = document.getElementById("campo-vincular-parceiro");
    if (tipo === "Casado") {
      campoVinculo.hidden = false;
      Cadastro._carregarCandidatosVinculo();
    } else {
      campoVinculo.hidden = true;
    }
});
document.getElementById("cadastro-sexo")?.addEventListener("change", () => {
  if (document.getElementById("cadastro-categoria").value === "Casado") Cadastro._carregarCandidatosVinculo();
});

document.getElementById("form-cadastro")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const nome = document.getElementById("cadastro-nome").value.trim();
  const telefone = document.getElementById("cadastro-telefone").value.trim();
  const apelido = document.getElementById("cadastro-apelido").value.trim();
  const sexo = document.getElementById("cadastro-sexo").value;
  const categoriaServico = document.getElementById("cadastro-categoria").value;
  const idParceiro = document.getElementById("cadastro-parceiro").value;
  const participaDe = Array.from(document.querySelectorAll('input[name="cadastro-pastoral"]:checked')).map((x) => x.value).join(",") || "Nenhum";
  const preferenciaHorarios = Array.from(document.querySelectorAll('input[name="cadastro-horario"]:checked')).map((x) => x.value).join(",");
  const preferenciaIgreja = document.getElementById("cadastro-preferencia-igreja").value;

  const botao = evento.target.querySelector("button[type=submit]");
  botao.disabled = true;
  botao.textContent = "Criando...";

  const dados = {
    nome,
    apelido,
    telefone,
    sexo,
    categoriaServico,
    casado: categoriaServico === "Casado",
    participaDe,
    preferenciaIgreja,
    preferenciaHorarios,
    status: "Ativo",
    vinculoConjugeId: idParceiro || "",
    casalPendente: categoriaServico === "Casado" && !idParceiro,
  };

  const resposta = await Api.criar("membros", dados);

  botao.disabled = false;
  botao.textContent = "Criar conta";

  if (!resposta.sucesso) {
    UI.mostrarToast(resposta.erro || "Não foi possível criar a conta.");
    return;
  }

  // Se escolheu um parceiro já cadastrado, vincula os dois automaticamente.
  if (idParceiro) {
    await Api.atualizar("membros", { acao: "vincularParceirosAutocadastro", id: resposta.dados.id, idParceiro });
  }

  Auth.membroLogado = resposta.dados;
  Storage.salvar(CONFIG.CHAVES_LOCAL.SESSAO_MEMBRO, resposta.dados.id);
  UI.mostrarToast("Conta criada! Bem-vindo(a).");
  await App.abrirPainelDoMembro();
});
