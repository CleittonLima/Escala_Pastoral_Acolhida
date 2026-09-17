/**
 * Members.gs
 * CRUD de MEMBROS com:
 *   - Verificação de telefone duplicado antes de criar
 *   - LockService para evitar corrida em gravações simultâneas
 *   - Auto-cadastro pelo próprio membro
 *   - Vínculo de casal/ECC
 * E leitura/gravação de DISPONIBILIDADE mensal.
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

  if (parametros.pendentesDeVinculo) {
    const tipo = parametros.pendentesDeVinculo;
    const sexoDesejado = parametros.sexoDesejado || "";
    const pendentes = membros.filter((m) => {
      const ehCasado = m.casado === true || m.casado === "true";
      const mesmoTipo = tipo === "Casado" ? ehCasado : (m.participaDe || "").indexOf("ECC") !== -1;
      return mesmoTipo && !m.vinculoConjugeId && (!sexoDesejado || m.sexo === sexoDesejado);
    });
    // O cadastro só precisa de identidade mínima para montar a lista de cônjuge.
    return respostaSucesso(pendentes.map((m) => ({ id: m.id, nome: m.nome, sexo: m.sexo })));
  }

  return respostaSucesso(membros);
}

function criarMembro(dados) {
  if (!dados.nome || !dados.telefone) {
    return respostaErro("Nome e telefone são obrigatórios.");
  }

  // LockService: evita criação duplicada por cliques rápidos simultâneos
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return respostaErro("Servidor ocupado, tente em instantes.");
  }

  try {
    // Verificar telefone duplicado
    const telefoneLimpo = String(dados.telefone).replace(/\D/g, "");
    const existentes = lerTodasAsLinhas("MEMBROS");
    const jaExiste = existentes.some((m) => String(m.telefone).replace(/\D/g, "") === telefoneLimpo);
    if (jaExiste) {
      return respostaErro("Já existe uma conta com esse número de telefone.");
    }

    const membro = {
      id: gerarId("mem"),
      nome: dados.nome,
      apelido: dados.apelido || "",
      telefone: telefoneLimpo,
      whatsapp: dados.whatsapp ? String(dados.whatsapp).replace(/\D/g, "") : telefoneLimpo,
      email: dados.email || "",
      casado: dados.casado === "true" || dados.casado === true,
      nomeConjuge: dados.nomeConjuge || "",
      participaDe: dados.participaDe || "Nenhum",
      comunidade: dados.comunidade || "",
      preferenciaIgreja: dados.preferenciaIgreja || "Sem preferência",
      preferenciaHorarios: dados.preferenciaHorarios || "",
      sexo: dados.sexo || "",
      categoriaServico: dados.categoriaServico || _categoriaPadrao(dados),
      observacoes: dados.observacoes || "",
      status: dados.status || "Ativo",
      dataCadastro: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      vinculoConjugeId: dados.vinculoConjugeId || "",
      casalPendente: dados.casalPendente === true || dados.casalPendente === "true",
      autoCadastro: dados.autoCadastro === true,
    };

    inserirLinha("MEMBROS", membro);
    return respostaSucesso(membro);
  } finally {
    lock.releaseLock();
  }
}

function atualizarMembro(dados) {
  if (dados.acao === "vincularParceiros" || dados.acao === "vincularParceirosAutocadastro") {
    return _vincularParceiros(dados.id, dados.idParceiro);
  }
  if (!dados.id) return respostaErro("ID do membro não informado.");

  // Normalizar telefone se veio para atualizar
  if (dados.telefone) dados.telefone = String(dados.telefone).replace(/\D/g, "");
  if (dados.whatsapp) dados.whatsapp = String(dados.whatsapp).replace(/\D/g, "");
  if (dados.casado !== undefined) dados.casado = dados.casado === "true" || dados.casado === true;
  if (dados.casalPendente !== undefined) {
    dados.casalPendente = dados.casalPendente === "true" || dados.casalPendente === true;
  }

  const encontrado = atualizarLinhaPorId("MEMBROS", dados);
  return encontrado ? respostaSucesso(dados) : respostaErro("Membro não encontrado.");
}

function _vincularParceiros(idMembro, idParceiro) {
  if (!idMembro || !idParceiro) return respostaErro("Selecione os dois membros para vincular.");
  if (idMembro === idParceiro) return respostaErro("Uma pessoa não pode ser vinculada a si mesma.");
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return respostaErro("Servidor ocupado."); }
  try {
    const membros = lerTodasAsLinhas("MEMBROS");
    const membro = membros.find((m) => m.id === idMembro);
    const parceiro = membros.find((m) => m.id === idParceiro);
    if (!membro || !parceiro) return respostaErro("Membro não encontrado.");
    if (!(membro.casado === true || membro.casado === "true") || !(parceiro.casado === true || parceiro.casado === "true")) {
      return respostaErro("Apenas pessoas marcadas como casadas podem formar um casal na escala.");
    }
    if (!membro.sexo || !parceiro.sexo || membro.sexo === parceiro.sexo) {
      return respostaErro("Informe sexos diferentes para vincular o casal.");
    }
    if ((membro.vinculoConjugeId && membro.vinculoConjugeId !== idParceiro) ||
        (parceiro.vinculoConjugeId && parceiro.vinculoConjugeId !== idMembro)) {
      return respostaErro("Um dos membros já está vinculado a outro cônjuge.");
    }
    atualizarLinhaPorId("MEMBROS", { id: idMembro,  vinculoConjugeId: idParceiro, casalPendente: false });
    atualizarLinhaPorId("MEMBROS", { id: idParceiro, vinculoConjugeId: idMembro,  casalPendente: false });
    return respostaSucesso({ vinculado: true });
  } finally {
    lock.releaseLock();
  }
}

function _categoriaPadrao(dados) {
  if (dados.casado === true || dados.casado === "true") return "Casado";
  return (dados.participaDe || "").indexOf("EJC") !== -1 ? "Jovem" : "Adulto";
}

function removerMembro(id) {
  if (!id) return respostaErro("ID não informado.");
  // Limpar vínculo de casal do parceiro, se houver
  const todos = lerTodasAsLinhas("MEMBROS");
  const membro = todos.find((m) => m.id === id);
  if (membro && membro.vinculoConjugeId) {
    atualizarLinhaPorId("MEMBROS", { id: membro.vinculoConjugeId, vinculoConjugeId: "", casalPendente: false });
  }
  const encontrado = removerLinhaPorId("MEMBROS", id);
  return encontrado ? respostaSucesso({ removido: true }) : respostaErro("Membro não encontrado.");
}

/* ---- Disponibilidade mensal ---- */

function obterDisponibilidade(parametros) {
  const todas = lerTodasAsLinhas("DISPONIBILIDADE");
  // membroId="todos" => retorna todas (usado pelo coordenador na troca manual)
  if (parametros.membroId === "todos") {
    const filtradas = parametros.mesReferencia
      ? todas.filter((d) => d.mesReferencia === parametros.mesReferencia)
      : todas;
    return respostaSucesso(filtradas);
  }
  const registro = todas.find(
    (d) => d.membroId === parametros.membroId && d.mesReferencia === parametros.mesReferencia
  );
  return respostaSucesso(registro || {});
}

function salvarDisponibilidade(dados) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return respostaErro("Servidor ocupado, tente em instantes."); }

  try {
    const todas = lerTodasAsLinhas("DISPONIBILIDADE");
    const existente = todas.find(
      (d) => d.membroId === dados.membroId && d.mesReferencia === dados.mesReferencia
    );

    if (existente && (existente.congelada === true || existente.congelada === "true")) {
      return respostaErro("A disponibilidade deste mês já foi congelada após a publicação da escala.");
    }

    const registro = {
      id: existente ? existente.id : gerarId("disp"),
      membroId: dados.membroId,
      mesReferencia: dados.mesReferencia,
      quinta:        !!dados.quinta,
      sabado:        !!dados.sabado,
      domingoManha:  !!dados.domingoManha,
      domingoNoite:  !!dados.domingoNoite,
      observacoesMes: dados.observacoesMes || "",
      congelada: false,
    };

    if (existente) {
      atualizarLinhaPorId("DISPONIBILIDADE", registro);
    } else {
      inserirLinha("DISPONIBILIDADE", registro);
    }
    return respostaSucesso(registro);
  } finally {
    lock.releaseLock();
  }
}

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
