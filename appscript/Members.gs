/**
 * Members.gs
 * CRUD de MEMBROS e leitura/gravação de DISPONIBILIDADE mensal.
 */

function obterMembros(parametros) {
  let membros = lerTodasAsLinhas("MEMBROS");

  if (parametros.id) {
    const membro = membros.find((m) => m.id === parametros.id);
    return membro ? respostaSucesso(membro) : respostaErro("Membro não encontrado.");
  }

  if (parametros.telefone) {
    const telefoneBuscado = String(parametros.telefone).replace(/\D/g, "");
    const membro = membros.find((m) => String(m.telefone).replace(/\D/g, "") === telefoneBuscado);
    return membro ? respostaSucesso(membro) : respostaErro("Telefone não encontrado.");
  }

  if (parametros.disponiveisPara) {
    const disponiveis = _membrosDisponiveis(parametros.mesReferencia).map((m) => m.membro);
    return respostaSucesso(disponiveis);
  }

  return respostaSucesso(membros);
}

function criarMembro(dados) {
  if (!dados.nome || !dados.telefone) return respostaErro("Nome e telefone são obrigatórios.");

  const membro = {
    id: gerarId("mem"),
    nome: dados.nome,
    telefone: dados.telefone,
    whatsapp: dados.whatsapp || dados.telefone,
    email: dados.email || "",
    casado: dados.casado === "true" || dados.casado === true,
    nomeConjuge: dados.nomeConjuge || "",
    participaDe: dados.participaDe || "Nenhum",
    comunidade: dados.comunidade || "",
    preferenciaIgreja: dados.preferenciaIgreja || "Sem preferência",
    observacoes: dados.observacoes || "",
    status: dados.status || "Ativo",
    dataCadastro: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
  };

  inserirLinha("MEMBROS", membro);
  return respostaSucesso(membro);
}

function atualizarMembro(dados) {
  if (!dados.id) return respostaErro("ID do membro não informado.");
  dados.casado = dados.casado === "true" || dados.casado === true;
  const encontrado = atualizarLinhaPorId("MEMBROS", dados);
  return encontrado ? respostaSucesso(dados) : respostaErro("Membro não encontrado.");
}

function removerMembro(id) {
  const encontrado = removerLinhaPorId("MEMBROS", id);
  return encontrado ? respostaSucesso({ removido: true }) : respostaErro("Membro não encontrado.");
}

/* ---- Disponibilidade mensal ---- */

function obterDisponibilidade(parametros) {
  const todas = lerTodasAsLinhas("DISPONIBILIDADE");
  const registro = todas.find(
    (d) => d.membroId === parametros.membroId && d.mesReferencia === parametros.mesReferencia
  );
  return respostaSucesso(registro || {});
}

function salvarDisponibilidade(dados) {
  const todas = lerTodasAsLinhas("DISPONIBILIDADE");
  const existente = todas.find(
    (d) => d.membroId === dados.membroId && d.mesReferencia === dados.mesReferencia
  );

  if (existente && existente.congelada === true) {
    return respostaErro("A disponibilidade deste mês já foi congelada após a publicação da escala.");
  }

  const registro = {
    id: existente ? existente.id : gerarId("disp"),
    membroId: dados.membroId,
    mesReferencia: dados.mesReferencia,
    quinta: !!dados.quinta,
    sabado: !!dados.sabado,
    domingoManha: !!dados.domingoManha,
    domingoNoite: !!dados.domingoNoite,
    observacoesMes: dados.observacoesMes || "",
    congelada: false,
  };

  if (existente) {
    atualizarLinhaPorId("DISPONIBILIDADE", registro);
  } else {
    inserirLinha("DISPONIBILIDADE", registro);
  }
  return respostaSucesso(registro);
}

/**
 * Retorna membros ativos com disponibilidade preenchida para o mês informado,
 * já acompanhados de seu registro de disponibilidade (usado pelo Scheduler).
 */
function _membrosDisponiveis(mesReferencia) {
  const membros = lerTodasAsLinhas("MEMBROS").filter((m) => m.status === "Ativo");
  const disponibilidades = lerTodasAsLinhas("DISPONIBILIDADE").filter(
    (d) => d.mesReferencia === mesReferencia
  );

  return membros
    .map((membro) => {
      const disponibilidade = disponibilidades.find((d) => d.membroId === membro.id);
      return disponibilidade ? { membro, disponibilidade } : null;
    })
    .filter(Boolean);
}
