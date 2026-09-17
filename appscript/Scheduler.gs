/**
 * Scheduler.gs
 * Algoritmo de geração automática de escalas (pontuação documentada abaixo),
 * CRUD de ESCALAS, HISTORICO, Dashboard e Relatórios.
 *
 * ------------------------------------------------------------------
 * ALGORITMO DE PONTUAÇÃO
 *
 *   +5  por semana completa sem servir (teto +50)
 *   +30 nunca serviu naquele horário específico
 *   +20 é da mesma comunidade da igreja
 *   +20 tem preferência por aquela igreja
 *   +40 prioridade manual definida pelo coordenador (coluna na planilha)
 *  +100 bônus de casal: cônjuge vinculado já foi escalado na MESMA vaga
 *   -50 serviu nas 2 últimas escalas
 *   -80 já tem 2+ escalas confirmadas neste mês
 *
 * Indisponível no dia → excluído. Inativo → excluído.
 * Empate → sorteio ponderado.
 * ------------------------------------------------------------------
 */

const PONTOS = {
  POR_SEMANA_SEM_SERVIR:       5,
  TETO_TEMPO_SEM_SERVIR:      50,
  NUNCA_SERVIU_NESTE_HORARIO: 30,
  MESMA_COMUNIDADE:           20,
  TEM_PREFERENCIA:            20,
  PRIORIDADE_MANUAL:          40,
  BONUS_CONJUGE_JUNTO:       100,
  SERVIU_RECENTEMENTE:       -50,
  MUITAS_ESCALAS_NO_MES:     -80,
};

/* ==========================================================================
   CRUD DE ESCALAS
   ========================================================================== */

function obterEscalas(parametros) {
  let escalas = lerTodasAsLinhas("ESCALAS");

  if (parametros.membroId)    escalas = escalas.filter((e) => e.membroId === parametros.membroId);
  if (parametros.mesReferencia) escalas = escalas.filter((e) => e.mesReferencia === parametros.mesReferencia);

  if (parametros.somenteFuturas === "true" || parametros.somenteFuturas === true) {
    const hojeISO = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    escalas = escalas.filter((e) => e.data >= hojeISO);
  }

  escalas.sort((a, b) => (a.data > b.data ? 1 : -1));
  if (parametros.limite) escalas = escalas.slice(0, Number(parametros.limite));
  return respostaSucesso(escalas);
}

function criarEscala(dados) {
  if (dados.acao === "gerarAutomatica") {
    return respostaSucesso(gerarEscalaAutomatica(dados.mesReferencia));
  }
  if (dados.acao === "duplicar") return _salvarRascunhoEscala(dados.mesReferencia, dados.vagas || []);

  const escala = {
    id: gerarId("esc"),
    mesReferencia:  dados.mesReferencia || "",
    igrejaId:       dados.igrejaId || "",
    igrejaNome:     dados.igrejaNome || "",
    eventoId:       dados.eventoId || "",
    eventoNome:     dados.eventoNome || "",
    data:           dados.data,
    horario:        dados.horario,
    funcao:         dados.funcao,
    membroId:       dados.membroId || "",
    membroNome:     dados.membroNome || "",
    status:         "rascunho",
    dataPublicacao: "",
  };
  inserirLinha("ESCALAS", escala);
  return respostaSucesso(escala);
}

function _salvarRascunhoEscala(mesReferencia, vagas) {
  const existentes = lerTodasAsLinhas("ESCALAS").filter((e) => e.mesReferencia === mesReferencia && e.status === "rascunho");
  existentes.forEach((e) => removerLinhaPorId("ESCALAS", e.id));
  vagas.forEach((vaga) => {
    const ids = (vaga.membroIds || vaga.membroId || "").split(",").filter(Boolean);
    const nomes = (vaga.membroNome || "").split(" + ");
    if (!ids.length) ids.push("");
    const grupoId = ids.length > 1 ? gerarId("casal") : "";
    ids.forEach((membroId, indice) => inserirLinha("ESCALAS", {
      id: gerarId("esc"), mesReferencia, igrejaId: vaga.igrejaId || "", igrejaNome: vaga.igrejaNome || "",
      eventoId: vaga.eventoId || "", eventoNome: vaga.eventoNome || "", data: vaga.data, horario: vaga.horario,
      funcao: vaga.funcao, membroId, membroNome: nomes[indice] || "", grupoId, tipoUnidade: vaga.tipoUnidade || vaga.funcao,
      status: "rascunho", dataPublicacao: "",
    }));
  });
  return respostaSucesso({ salvo: true, quantidade: vagas.length });
}

function atualizarEscala(dados) {
  if (dados.acao === "publicar") return _publicarEscala(dados.mesReferencia, dados.vagas || []);
  if (!dados.id) return respostaErro("ID da escala não informado.");
  const encontrada = atualizarLinhaPorId("ESCALAS", dados);
  return encontrada ? respostaSucesso(dados) : respostaErro("Escala não encontrada.");
}

function removerEscala(id) {
  const encontrada = removerLinhaPorId("ESCALAS", id);
  return encontrada ? respostaSucesso({ removido: true }) : respostaErro("Escala não encontrada.");
}

/* ==========================================================================
   GERAÇÃO AUTOMÁTICA
   ========================================================================== */

function gerarEscalaAutomatica(mesReferencia) {
  const igrejas      = lerTodasAsLinhas("IGREJAS");
  const eventosDoMes = lerTodasAsLinhas("EVENTOS").filter((ev) => (ev.data || "").startsWith(mesReferencia));
  const candidatos   = _membrosDisponiveis(mesReferencia);
  const historico    = lerTodasAsLinhas("HISTORICO");
  const escalasDoMes = lerTodasAsLinhas("ESCALAS").filter((e) => e.mesReferencia === mesReferencia);
  const prioridades = _lerPrioridadesManuais(mesReferencia);
  const vagas = _montarVagasDoMes(igrejas, eventosDoMes, mesReferencia);
  const unidades = _montarUnidadesElegiveis(candidatos);
  const contadorNoRascunho = {};
  const vagasPreenchidas = vagas.map((vaga) => {
    let elegiveis = unidades.filter((u) =>
      u.tipo === vaga.funcao && u.disponibilidades.every((d) => _membroDisponivelNoDia(d, vaga.diaSemanaChave))
    );
    // Não escala a mesma pessoa duas vezes para a mesma celebração.
    elegiveis = elegiveis.filter((u) => !vagasPreenchidas.some((v) =>
      v.data === vaga.data && v.horario === vaga.horario && v.igrejaId === vaga.igrejaId &&
      (v.membroIds || "").split(",").some((id) => u.membros.some((m) => m.id === id))
    ));
    if (!elegiveis.length) return { ...vaga, membroIds: "", membroId: "", membroNome: "", tipoUnidade: vaga.funcao };

    // A repetição do mesmo local e horário no mês anterior só é aceita quando não existe alternativa.
    const semRepeticao = elegiveis.filter((u) => !u.membros.some((m) => _serviuMesmoLocalHorarioNoMesAnterior(m, vaga, historico)));
    if (semRepeticao.length) elegiveis = semRepeticao;

    const pontuados = elegiveis.map((unidade) => ({
      unidade,
      pontuacao: _pontuarUnidade(unidade, vaga, historico, escalasDoMes, contadorNoRascunho, prioridades),
    })).sort((a, b) => b.pontuacao - a.pontuacao);
    const maior = pontuados[0].pontuacao;
    const empatados = pontuados.filter((p) => p.pontuacao === maior);
    const escolhido = empatados[Math.floor(Math.random() * empatados.length)].unidade;
    escolhido.membros.forEach((m) => { contadorNoRascunho[m.id] = (contadorNoRascunho[m.id] || 0) + 1; });
    return {
      ...vaga,
      membroIds: escolhido.membros.map((m) => m.id).join(","),
      membroId: escolhido.membros[0].id,
      membroNome: escolhido.membros.map((m) => m.nome).join(" + "),
      tipoUnidade: escolhido.tipo,
    };
  });

  return vagasPreenchidas;
}

/** Monta casais como uma unidade inseparável e solteiros por categoria. */
function _montarUnidadesElegiveis(candidatos) {
  const porId = {};
  candidatos.forEach((c) => { porId[c.membro.id] = c; });
  const unidades = [];
  const casaisIncluidos = {};
  candidatos.forEach((c) => {
    const m = c.membro;
    const parceiro = porId[m.vinculoConjugeId];
    const ehCasalValido = (m.casado === true || m.casado === "true") && parceiro &&
      parceiro.membro.vinculoConjugeId === m.id &&
      m.sexo && parceiro.membro.sexo && m.sexo !== parceiro.membro.sexo;
    if (ehCasalValido) {
      const chave = [m.id, parceiro.membro.id].sort().join(":");
      if (!casaisIncluidos[chave]) {
        casaisIncluidos[chave] = true;
        unidades.push({ tipo: "Casal", membros: [m, parceiro.membro], disponibilidades: [c.disponibilidade, parceiro.disponibilidade] });
      }
      return;
    }
    if (m.casado === true || m.casado === "true") return; // casado sem vínculo não ocupa vaga de casal sozinho
    unidades.push({ tipo: "Jovem", membros: [m], disponibilidades: [c.disponibilidade] });
  });
  return unidades;
}

function _pontuarUnidade(unidade, vaga, historico, escalasDoMes, contador, prioridades) {
  return unidade.membros.reduce((total, membro) => {
    const participacoes = historico.filter((h) => h.membroId === membro.id);
    const ultimaData = participacoes.map((h) => h.data).sort().pop();
    let pontos = Math.min(Math.floor(diasDesde(ultimaData) / 7) * PONTOS.POR_SEMANA_SEM_SERVIR, PONTOS.TETO_TEMPO_SEM_SERVIR);
    if (!participacoes.some((h) => h.horario === vaga.horario)) pontos += PONTOS.NUNCA_SERVIU_NESTE_HORARIO;
    if (membro.comunidade === vaga.igrejaNome) pontos += PONTOS.MESMA_COMUNIDADE;
    if (membro.preferenciaIgreja === vaga.igrejaNome) pontos += PONTOS.TEM_PREFERENCIA;
    if ((membro.preferenciaHorarios || "").split(",").map((x) => x.trim()).includes(vaga.diaSemanaChave)) pontos += 15;
    if (prioridades[membro.id]) pontos += PONTOS.PRIORIDADE_MANUAL;
    const noMes = escalasDoMes.filter((e) => e.membroId === membro.id).length + (contador[membro.id] || 0);
    if (noMes >= 2) pontos += PONTOS.MUITAS_ESCALAS_NO_MES;
    return total + pontos;
  }, 0);
}

function _serviuMesmoLocalHorarioNoMesAnterior(membro, vaga, historico) {
  const data = new Date(vaga.data + "T12:00:00");
  data.setMonth(data.getMonth() - 1);
  const mesAnterior = Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM");
  return historico.some((h) => h.membroId === membro.id && (h.data || "").startsWith(mesAnterior) &&
    h.local === vaga.igrejaNome && h.horario === vaga.horario);
}

/** Lê a aba PRIORIDADES (cria se não existir) — coordenador pode marcar manualmente. */
function _lerPrioridadesManuais(mesReferencia) {
  const linhas = lerTodasAsLinhas("PRIORIDADES");
  const mapa = {};
  linhas.filter((l) => l.mesReferencia === mesReferencia).forEach((l) => {
    mapa[l.membroId] = true;
  });
  return mapa;
}

/**
 * Monta vagas a partir dos HORÁRIOS REAIS da igreja.
 * O campo "horarios" armazena dias separados por vírgula, ex.: "Qui 19h, Dom 7h, Dom 19h".
 * Cada entrada é mapeada para o dia-chave correspondente:
 *   Qui → quinta   Sáb / Sab → sabado   Dom (manhã ≤ 12h) → domingoManha   Dom (>12h) → domingoNoite
 * Se "horarios" estiver vazio, NÃO gera vagas automáticas para essa igreja —
 * o coordenador deve preencher antes de gerar.
 */
function _montarVagasDoMes(igrejas, eventosDoMes, mesReferencia) {
  const vagas = [];
  const datasDoMes = _datasDoMesPorDiaSemana(mesReferencia);

  igrejas.forEach((igreja) => {
    const diaChavesAtivos = _celebracoesDaIgreja(igreja);

    diaChavesAtivos.forEach(({ diaChave, horarioTexto, qtdCasais, qtdJovens }) => {
      const datas = datasDoMes[diaChave] || [];
      datas.forEach((data) => {
        _funcoesPorQuantidade({ qtdCasais, qtdJovens }).forEach((funcao) => {
          vagas.push({
            igrejaId:      igreja.id,
            igrejaNome:    igreja.nome,
            eventoId:      "",
            eventoNome:    "",
            data,
            horario:       horarioTexto,
            diaSemanaChave: diaChave,
            funcao,
          });
        });
      });
    });
  });

  eventosDoMes.forEach((evento) => {
    const igreja = igrejas.find((i) => i.nome === evento.local) || {};
    [
      ...Array(Number(evento.qtdCasais)  || 0).fill("Casal"),
      ...Array(Number(evento.qtdJovens)  || 0).fill("Jovem"),
    ].forEach((funcao) => {
      vagas.push({
        igrejaId:      igreja.id || "",
        igrejaNome:    evento.local,
        eventoId:      evento.id,
        eventoNome:    evento.nome,
        data:          evento.data,
        horario:       evento.hora,
        diaSemanaChave: "evento",
        funcao,
      });
    });
  });

  return vagas;
}

/**
 * Converte o campo de texto livre "Qui 19h, Dom 7h, Sáb 18h" em lista de
 * { diaChave, horarioTexto }.  Ignora entradas que não reconhece.
 */
function _parsearDiasIgreja(horarioStr) {
  const resultado = [];
  if (!horarioStr) return resultado;

  const partes = horarioStr.split(",").map((p) => p.trim());
  partes.forEach((parte) => {
    const upper = parte.toUpperCase();
    let diaChave = null;

    if (upper.startsWith("QUI"))              diaChave = "quinta";
    else if (upper.startsWith("SÁB") || upper.startsWith("SAB")) diaChave = "sabado";
    else if (upper.startsWith("DOM")) {
      // Extrair hora para separar manhã de noite
      const horaMatch = parte.match(/(\d{1,2})[hH]/);
      const hora = horaMatch ? parseInt(horaMatch[1], 10) : 18;
      diaChave = hora <= 12 ? "domingoManha" : "domingoNoite";
    }

    if (diaChave) resultado.push({ diaChave, horarioTexto: parte });
  });
  return resultado;
}

/** Agenda estruturada do painel: dia da semana e hora não dependem de texto livre. */
function _celebracoesDaIgreja(igreja) {
  try {
    const agenda = JSON.parse(igreja.celebracoes || "[]");
    if (Array.isArray(agenda) && agenda.length) {
      return agenda.map((c) => ({
        diaChave: c.diaChave,
        horarioTexto: c.horario,
        qtdCasais: Number(c.qtdCasais) || 0,
        qtdJovens: Number(c.qtdJovens) || 0,
      })).filter((c) => c.diaChave && c.horario);
    }
  } catch (e) { /* tenta formato legado abaixo */ }
  return _parsearDiasIgreja(igreja.horarios || "").map((c) => ({
    ...c, qtdCasais: Number(igreja.qtdCasais) || 0, qtdJovens: Number(igreja.qtdJovens) || 0,
  }));
}

function _funcoesPorQuantidade(igreja) {
  return [
    ...Array(Number(igreja.qtdCasais)  || 0).fill("Casal"),
    ...Array(Number(igreja.qtdJovens)  || 0).fill("Jovem"),
  ];
}

function _datasDoMesPorDiaSemana(mesReferencia) {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const ultimoDia  = new Date(ano, mes, 0).getDate();
  const resultado  = { quinta: [], sabado: [], domingoManha: [], domingoNoite: [] };

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const data     = new Date(ano, mes - 1, dia);
    const semana   = data.getDay();
    const dataISO  = Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM-dd");

    if (semana === 4) resultado.quinta.push(dataISO);
    if (semana === 6) resultado.sabado.push(dataISO);
    if (semana === 0) {
      resultado.domingoManha.push(dataISO);
      resultado.domingoNoite.push(dataISO);
    }
  }
  return resultado;
}

function _membroDisponivelNoDia(disponibilidade, diaChave) {
  if (diaChave === "evento") return true;
  return disponibilidade[diaChave] === true || disponibilidade[diaChave] === "true";
}

/**
 * Calcula a pontuação total de um membro para uma vaga.
 * vagasJaAlocadas permite aplicar o bônus de casal quando o cônjuge
 * já foi escalado em outra vaga da mesma data/horário/igreja.
 */
function _calcularPontuacao(membro, vaga, historico, escalasDoMes,
                             contadorNoRascunho, prioridades, vagasJaAlocadas, membrosMap) {
  let pts = 0;
  const participacoes = historico.filter((h) => h.membroId === membro.id);

  // +tempo sem servir
  const ultimaData = participacoes.map((h) => h.data).sort().pop();
  const semanas = Math.floor(diasDesde(ultimaData) / 7);
  pts += Math.min(semanas * PONTOS.POR_SEMANA_SEM_SERVIR, PONTOS.TETO_TEMPO_SEM_SERVIR);

  // +nunca serviu neste horário
  if (!participacoes.some((h) => h.horario === vaga.horario)) pts += PONTOS.NUNCA_SERVIU_NESTE_HORARIO;

  // +comunidade / preferência
  if (membro.comunidade      === vaga.igrejaNome) pts += PONTOS.MESMA_COMUNIDADE;
  if (membro.preferenciaIgreja === vaga.igrejaNome) pts += PONTOS.TEM_PREFERENCIA;

  // +prioridade manual
  if (prioridades[membro.id]) pts += PONTOS.PRIORIDADE_MANUAL;

  // +bônus de casal: cônjuge vinculado já escalado nesta vaga (mesma data+horário+igreja)
  if (membro.vinculoConjugeId) {
    const conjugeEscalado = (vagasJaAlocadas || []).some((v) =>
      v.membroId === membro.vinculoConjugeId &&
      v.data     === vaga.data &&
      v.horario  === vaga.horario &&
      v.igrejaId === vaga.igrejaId
    );
    if (conjugeEscalado) pts += PONTOS.BONUS_CONJUGE_JUNTO;
  }

  // −serviram recentemente (últimas 2 escalas ≤ 14 dias)
  const ultimas2 = participacoes.sort((a, b) => (a.data > b.data ? -1 : 1)).slice(0, 2);
  if (ultimas2.some((h) => diasDesde(h.data) <= 14)) pts += PONTOS.SERVIU_RECENTEMENTE;

  // −muitas escalas neste mês
  const noMesReal    = escalasDoMes.filter((e) => e.membroId === membro.id).length;
  const noRascunho   = contadorNoRascunho[membro.id] || 0;
  if (noMesReal + noRascunho >= 2) pts += PONTOS.MUITAS_ESCALAS_NO_MES;

  return pts;
}

/* ==========================================================================
   PUBLICAÇÃO
   ========================================================================== */

function _publicarEscala(mesReferencia, vagas) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return respostaErro("Servidor ocupado, tente em instantes."); }

  try {
    const jaPublicada = lerTodasAsLinhas("ESCALAS").some((e) => e.mesReferencia === mesReferencia && e.status === "publicada");
    if (jaPublicada) return respostaErro("Já existe uma escala publicada para este mês. Use a edição da escala publicada para fazer alterações.");
    vagas.forEach((vaga) => {
      const ids = (vaga.membroIds || vaga.membroId || "").split(",").filter(Boolean);
      const nomes = (vaga.membroNome || "").split(" + ");
      if (!ids.length) return; // vaga em aberto não entra no histórico
      const grupoId = ids.length > 1 ? gerarId("casal") : "";
      ids.forEach((membroId, indice) => {
      const membroNome = nomes[indice] || vaga.membroNome || "";
      inserirLinha("ESCALAS", {
        id:             gerarId("esc"),
        mesReferencia,
        igrejaId:       vaga.igrejaId,
        igrejaNome:     vaga.igrejaNome,
        eventoId:       vaga.eventoId || "",
        eventoNome:     vaga.eventoNome || "",
        data:           vaga.data,
        horario:        vaga.horario,
        funcao:         vaga.funcao,
        membroId,
        membroNome,
        grupoId,
        tipoUnidade:    vaga.tipoUnidade || vaga.funcao,
        status:         "publicada",
        dataPublicacao: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      });

      inserirLinha("HISTORICO", {
        id:         gerarId("hist"),
        membroId,
        membroNome,
        data:       vaga.data,
        local:      vaga.igrejaNome,
        evento:     vaga.eventoNome || "",
        horario:    vaga.horario,
        funcao:     vaga.funcao,
        presenca:   false,
      });

      inserirLinha("NOTIFICACOES", {
        id:          gerarId("notif"),
        destinatario: membroId,
        tipo:        "Escala publicada",
        mensagem:    `Você está na escala de ${vaga.igrejaNome} em ${vaga.data} (${vaga.horario}).`,
        data:        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        lida:        false,
      });
      });
    });

    _congelarDisponibilidade(mesReferencia);
    return respostaSucesso({ publicado: true, quantidade: vagas.filter((v) => v.membroId).length });
  } finally {
    lock.releaseLock();
  }
}

function _congelarDisponibilidade(mesReferencia) {
  const aba      = obterAba("DISPONIBILIDADE");
  const cabecalhos = _cabecalhosReaisDaAba(aba);
  const indiceCongelada = cabecalhos.indexOf("congelada");
  const indiceMes       = cabecalhos.indexOf("mesReferencia");
  if (indiceCongelada < 0 || indiceMes < 0) return;
  const valores  = aba.getDataRange().getValues();
  for (let i = 1; i < valores.length; i++) {
    if (valores[i][indiceMes] === mesReferencia) {
      aba.getRange(i + 1, indiceCongelada + 1).setValue(true);
    }
  }
}

/* ==========================================================================
   HISTÓRICO
   ========================================================================== */

function obterHistorico(parametros) {
  let historico = lerTodasAsLinhas("HISTORICO");
  if (parametros.membroId) historico = historico.filter((h) => h.membroId === parametros.membroId);
  historico.sort((a, b) => (a.data < b.data ? 1 : -1));
  return respostaSucesso(historico);
}

/* ==========================================================================
   PRIORIDADES MANUAIS
   ========================================================================== */

function obterPrioridades(parametros) {
  const linhas = lerTodasAsLinhas("PRIORIDADES");
  return respostaSucesso(linhas.filter((l) => l.mesReferencia === parametros.mesReferencia));
}

function salvarPrioridade(dados) {
  const existentes = lerTodasAsLinhas("PRIORIDADES");
  const jaExiste = existentes.find(
    (p) => p.membroId === dados.membroId && p.mesReferencia === dados.mesReferencia
  );
  if (jaExiste) {
    if (!dados.ativo) removerLinhaPorId("PRIORIDADES", jaExiste.id);
  } else if (dados.ativo) {
    inserirLinha("PRIORIDADES", {
      id: gerarId("pri"), membroId: dados.membroId, mesReferencia: dados.mesReferencia,
    });
  }
  return respostaSucesso({ salvo: true });
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */

function obterDashboard() {
  const membros    = lerTodasAsLinhas("MEMBROS").filter((m) => m.status === "Ativo");
  const igrejas    = lerTodasAsLinhas("IGREJAS");
  const eventos    = lerTodasAsLinhas("EVENTOS");
  const historico  = lerTodasAsLinhas("HISTORICO");
  const mesAtual   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  const escalasDoMes = lerTodasAsLinhas("ESCALAS").filter((e) => e.mesReferencia === mesAtual);
  const hojeISO    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  const proximasEscalas = lerTodasAsLinhas("ESCALAS")
    .filter((e) => e.data >= hojeISO && e.status === "publicada")
    .sort((a, b) => (a.data > b.data ? 1 : -1))
    .slice(0, 5);

  const proximosEventos = eventos
    .filter((e) => e.data >= hojeISO)
    .sort((a, b) => (a.data > b.data ? 1 : -1))
    .slice(0, 5);

  const membrosSemServirRecente = membros
    .map((m) => {
      const participacoes = historico.filter((h) => h.membroId === m.id).map((h) => h.data);
      return { nome: m.nome, diasSemServir: diasDesde(participacoes.sort().pop()) };
    })
    .sort((a, b) => b.diasSemServir - a.diasSemServir)
    .slice(0, 5);

  return respostaSucesso({
    totalMembros:         membros.length,
    totalCasais:          membros.filter((m) => m.casado === true || m.casado === "true").length,
    totalJovens:          membros.filter((m) => (m.participaDe || "").indexOf("EJC") !== -1).length,
    totalIgrejas:         igrejas.length,
    totalEventos:         eventos.length,
    escalasEsteMs:        escalasDoMes.length,
    igrejaSemHorario:     igrejas.filter((i) => !i.horarios).length, // alerta de igrejas incompletas
    proximasEscalas,
    proximosEventos,
    membrosSemServirRecente,
  });
}

/* ==========================================================================
   RELATÓRIOS
   ========================================================================== */

function obterRelatorios() {
  const historico     = lerTodasAsLinhas("HISTORICO");
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
  const dataLimite = Utilities.formatDate(seisMesesAtras, Session.getScriptTimeZone(), "yyyy-MM-dd");

  const recentes   = historico.filter((h) => h.data >= dataLimite);
  const contagem   = {};
  recentes.forEach((h) => { contagem[h.membroNome] = (contagem[h.membroNome] || 0) + 1; });

  const participacaoPorMembro = Object.entries(contagem)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);

  const mesAtual     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  const escalasDoMes = lerTodasAsLinhas("ESCALAS").filter((e) => e.mesReferencia === mesAtual);
  const vagasEmAberto = escalasDoMes.filter((e) => !e.membroId).length;

  return respostaSucesso({ participacaoPorMembro, vagasEmAberto });
}
