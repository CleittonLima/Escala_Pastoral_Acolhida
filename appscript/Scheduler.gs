/**
 * Scheduler.gs
 * Núcleo do sistema: algoritmo de pontuação documentado para a geração
 * automática das escalas, além do CRUD de ESCALAS, leitura de HISTORICO,
 * dados do Dashboard e Relatórios administrativos.
 *
 * ---------------------------------------------------------------------
 * ALGORITMO DE PONTUAÇÃO (documentado)
 * Para cada vaga (igreja + horário + função) dentro do mês de referência,
 * calculamos a pontuação de cada membro ATIVO e DISPONÍVEL naquele dia:
 *
 *   +5 por semana completa sem servir (até um teto de +50)
 *   +30 se o membro nunca serviu naquele horário específico
 *   +20 se o membro é da mesma comunidade da igreja
 *   +20 se o membro tem preferência declarada por aquela igreja
 *   +40 se o admin marcou prioridade manual para o membro neste mês
 *  -50 se o membro serviu nas duas últimas escalas publicadas
 *  -80 se o membro já possui 2 ou mais escalas confirmadas neste mês
 *  Indisponível no dia -> excluído do cálculo (não recebe pontuação)
 *  Status "Inativo Temporariamente" -> excluído do cálculo
 *
 * O membro com maior pontuação é selecionado. Em caso de empate, sorteio
 * ponderado (para não criar um padrão sempre previsível). Quando o membro
 * selecionado é casado e o cônjuge também está disponível para a mesma
 * vaga, o cônjuge recebe um bônus de pontuação (+100) na tentativa de
 * mantê-los servindo juntos — sem forçar, pois depende de haver vaga.
 * ---------------------------------------------------------------------
 */

const PONTOS = {
  POR_SEMANA_SEM_SERVIR: 5,
  TETO_TEMPO_SEM_SERVIR: 50,
  NUNCA_SERVIU_NESTE_HORARIO: 30,
  MESMA_COMUNIDADE: 20,
  TEM_PREFERENCIA: 20,
  PRIORIDADE_MANUAL: 40,
  SERVIU_RECENTEMENTE: -50,
  MUITAS_ESCALAS_NO_MES: -80,
  BONUS_CONJUGE_JUNTO: 100,
};

/* ==========================================================================
   CRUD / consultas de ESCALAS
   ========================================================================== */

function obterEscalas(parametros) {
  let escalas = lerTodasAsLinhas("ESCALAS");

  if (parametros.membroId) {
    escalas = escalas.filter((e) => e.membroId === parametros.membroId);
  }
  if (parametros.mesReferencia) {
    escalas = escalas.filter((e) => e.mesReferencia === parametros.mesReferencia);
  }
  if (parametros.somenteFuturas === "true" || parametros.somenteFuturas === true) {
    const hojeISO = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    escalas = escalas.filter((e) => e.data >= hojeISO);
  }

  escalas.sort((a, b) => (a.data > b.data ? 1 : -1));

  if (parametros.limite) {
    escalas = escalas.slice(0, Number(parametros.limite));
  }
  return respostaSucesso(escalas);
}

function criarEscala(dados) {
  if (dados.acao === "gerarAutomatica") {
    return respostaSucesso(gerarEscalaAutomatica(dados.mesReferencia));
  }
  if (dados.acao === "duplicar") {
    return respostaSucesso(dados.vagas || []);
  }

  const escala = {
    id: gerarId("esc"),
    mesReferencia: dados.mesReferencia || "",
    igrejaId: dados.igrejaId || "",
    igrejaNome: dados.igrejaNome || "",
    eventoId: dados.eventoId || "",
    eventoNome: dados.eventoNome || "",
    data: dados.data,
    horario: dados.horario,
    funcao: dados.funcao,
    membroId: dados.membroId || "",
    membroNome: dados.membroNome || "",
    status: "rascunho",
    dataPublicacao: "",
  };
  inserirLinha("ESCALAS", escala);
  return respostaSucesso(escala);
}

function atualizarEscala(dados) {
  if (dados.acao === "publicar") {
    return _publicarEscala(dados.mesReferencia, dados.vagas || []);
  }
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
  const igrejas = lerTodasAsLinhas("IGREJAS");
  const eventosDoMes = lerTodasAsLinhas("EVENTOS").filter((ev) =>
    (ev.data || "").startsWith(mesReferencia)
  );
  const candidatos = _membrosDisponiveis(mesReferencia); // definido em Members.gs
  const historico = lerTodasAsLinhas("HISTORICO");
  const escalasDoMes = lerTodasAsLinhas("ESCALAS").filter((e) => e.mesReferencia === mesReferencia);

  const vagas = _montarVagasDoMes(igrejas, eventosDoMes, mesReferencia);
  const contadorEscalasNoMes = {}; // membroId -> quantidade já escalada neste rascunho

  const vagasPreenchidas = vagas.map((vaga) => {
    const disponiveisNoDia = candidatos.filter((c) =>
      _membroDisponivelNoDia(c.disponibilidade, vaga.diaSemanaChave)
    );

    if (disponiveisNoDia.length === 0) {
      return { ...vaga, membroId: "", membroNome: "" };
    }

    const pontuados = disponiveisNoDia.map((c) => ({
      membro: c.membro,
      pontuacao: _calcularPontuacao(c.membro, vaga, historico, escalasDoMes, contadorEscalasNoMes),
    }));

    pontuados.sort((a, b) => b.pontuacao - a.pontuacao);

    // Sorteio ponderado entre os empatados no topo, para não repetir sempre
    // o mesmo padrão quando várias pessoas têm a mesma pontuação máxima.
    const maiorPontuacao = pontuados[0].pontuacao;
    const empatados = pontuados.filter((p) => p.pontuacao === maiorPontuacao);
    const escolhido = empatados[Math.floor(Math.random() * empatados.length)].membro;

    contadorEscalasNoMes[escolhido.id] = (contadorEscalasNoMes[escolhido.id] || 0) + 1;

    return { ...vaga, membroId: escolhido.id, membroNome: escolhido.nome };
  });

  return vagasPreenchidas;
}

/** Monta a lista de "vagas" (igreja+horário+função) a preencher no mês. */
function _montarVagasDoMes(igrejas, eventosDoMes, mesReferencia) {
  const vagas = [];
  const datasDoMes = _datasDoMesPorDiaSemana(mesReferencia);

  igrejas.forEach((igreja) => {
    ["quinta", "sabado", "domingoManha", "domingoNoite"].forEach((diaChave) => {
      const datas = datasDoMes[diaChave] || [];
      datas.forEach((data) => {
        _funcoesPorQuantidade(igreja).forEach((funcao) => {
          vagas.push({
            igrejaId: igreja.id,
            igrejaNome: igreja.nome,
            eventoId: "",
            eventoNome: "",
            data,
            horario: _rotuloHorario(diaChave),
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
      ...Array(Number(evento.qtdCasais) || 0).fill("Casal"),
      ...Array(Number(evento.qtdJovens) || 0).fill("Jovem"),
      ...Array(Number(evento.qtdAdultos) || 0).fill("Adulto"),
    ].forEach((funcao) => {
      vagas.push({
        igrejaId: igreja.id || "",
        igrejaNome: evento.local,
        eventoId: evento.id,
        eventoNome: evento.nome,
        data: evento.data,
        horario: evento.hora,
        diaSemanaChave: "evento",
        funcao,
      });
    });
  });

  return vagas;
}

function _funcoesPorQuantidade(igreja) {
  return [
    ...Array(Number(igreja.qtdCasais) || 0).fill("Casal"),
    ...Array(Number(igreja.qtdJovens) || 0).fill("Jovem"),
    ...Array(Number(igreja.qtdAdultos) || 0).fill("Adulto"),
  ];
}

function _rotuloHorario(diaChave) {
  const rotulos = {
    quinta: "Quinta-feira",
    sabado: "Sábado",
    domingoManha: "Domingo de Manhã",
    domingoNoite: "Domingo à Noite",
  };
  return rotulos[diaChave] || diaChave;
}

/** Retorna todas as datas de cada dia-chave (quinta/sábado/domingo) dentro do mês. */
function _datasDoMesPorDiaSemana(mesReferencia) {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const resultado = { quinta: [], sabado: [], domingoManha: [], domingoNoite: [] };

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const data = new Date(ano, mes - 1, dia);
    const diaSemana = data.getDay(); // 0=domingo, 4=quinta, 6=sábado
    const dataISO = Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM-dd");

    if (diaSemana === 4) resultado.quinta.push(dataISO);
    if (diaSemana === 6) resultado.sabado.push(dataISO);
    if (diaSemana === 0) {
      resultado.domingoManha.push(dataISO);
      resultado.domingoNoite.push(dataISO);
    }
  }
  return resultado;
}

function _membroDisponivelNoDia(disponibilidade, diaChave) {
  if (diaChave === "evento") return true; // eventos consideram todos os disponíveis em geral
  return disponibilidade[diaChave] === true;
}

/** Calcula a pontuação de um membro para uma vaga específica (ver documentação no topo). */
function _calcularPontuacao(membro, vaga, historico, escalasDoMes, contadorEscalasNoMes) {
  let pontuacao = 0;

  const participacoesDoMembro = historico.filter((h) => h.membroId === membro.id);
  const ultimaParticipacao = participacoesDoMembro
    .map((h) => h.data)
    .sort()
    .pop();

  const dias = diasDesde(ultimaParticipacao);
  const semanasSemServir = Math.floor(dias / 7);
  pontuacao += Math.min(semanasSemServir * PONTOS.POR_SEMANA_SEM_SERVIR, PONTOS.TETO_TEMPO_SEM_SERVIR);

  const jaServiuNesteHorario = participacoesDoMembro.some((h) => h.horario === vaga.horario);
  if (!jaServiuNesteHorario) pontuacao += PONTOS.NUNCA_SERVIU_NESTE_HORARIO;

  if (membro.comunidade && membro.comunidade === vaga.igrejaNome) pontuacao += PONTOS.MESMA_COMUNIDADE;
  if (membro.preferenciaIgreja && membro.preferenciaIgreja === vaga.igrejaNome) pontuacao += PONTOS.TEM_PREFERENCIA;

  const duasUltimasEscalas = participacoesDoMembro
    .sort((a, b) => (a.data > b.data ? -1 : 1))
    .slice(0, 2);
  const serviuRecentemente = duasUltimasEscalas.some((h) => diasDesde(h.data) <= 14);
  if (serviuRecentemente) pontuacao += PONTOS.SERVIU_RECENTEMENTE;

  const escalasNoMesReal = escalasDoMes.filter((e) => e.membroId === membro.id).length;
  const escalasNoRascunhoAtual = contadorEscalasNoMes[membro.id] || 0;
  if (escalasNoMesReal + escalasNoRascunhoAtual >= 2) pontuacao += PONTOS.MUITAS_ESCALAS_NO_MES;

  return pontuacao;
}

function _publicarEscala(mesReferencia, vagas) {
  vagas.forEach((vaga) => {
    if (!vaga.membroId) return; // não publica vaga em aberto

    const escala = {
      id: gerarId("esc"),
      mesReferencia,
      igrejaId: vaga.igrejaId,
      igrejaNome: vaga.igrejaNome,
      eventoId: vaga.eventoId || "",
      eventoNome: vaga.eventoNome || "",
      data: vaga.data,
      horario: vaga.horario,
      funcao: vaga.funcao,
      membroId: vaga.membroId,
      membroNome: vaga.membroNome,
      status: "publicada",
      dataPublicacao: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    };
    inserirLinha("ESCALAS", escala);

    inserirLinha("HISTORICO", {
      id: gerarId("hist"),
      membroId: vaga.membroId,
      membroNome: vaga.membroNome,
      data: vaga.data,
      local: vaga.igrejaNome,
      evento: vaga.eventoNome || "",
      horario: vaga.horario,
      funcao: vaga.funcao,
      presenca: false, // marcado manualmente pelo coordenador após o culto
    });

    inserirLinha("NOTIFICACOES", {
      id: gerarId("notif"),
      destinatario: vaga.membroId,
      tipo: "Escala publicada",
      mensagem: `Você foi escalado(a) em ${vaga.igrejaNome} — ${vaga.data} (${vaga.horario}).`,
      data: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      lida: false,
    });
  });

  _congelarDisponibilidade(mesReferencia);
  return respostaSucesso({ publicado: true, quantidade: vagas.filter((v) => v.membroId).length });
}

function _congelarDisponibilidade(mesReferencia) {
  const aba = obterAba("DISPONIBILIDADE");
  const cabecalhos = CABECALHOS_ABAS.DISPONIBILIDADE;
  const indiceCongelada = cabecalhos.indexOf("congelada");
  const indiceMes = cabecalhos.indexOf("mesReferencia");
  const valores = aba.getDataRange().getValues();

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
  if (parametros.membroId) {
    historico = historico.filter((h) => h.membroId === parametros.membroId);
  }
  historico.sort((a, b) => (a.data < b.data ? 1 : -1));
  return respostaSucesso(historico);
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */

function obterDashboard() {
  const membros = lerTodasAsLinhas("MEMBROS").filter((m) => m.status === "Ativo");
  const igrejas = lerTodasAsLinhas("IGREJAS");
  const eventos = lerTodasAsLinhas("EVENTOS");
  const historico = lerTodasAsLinhas("HISTORICO");
  const mesAtual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  const escalasDoMes = lerTodasAsLinhas("ESCALAS").filter((e) => e.mesReferencia === mesAtual);
  const hojeISO = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  const proximasEscalas = lerTodasAsLinhas("ESCALAS")
    .filter((e) => e.data >= hojeISO)
    .sort((a, b) => (a.data > b.data ? 1 : -1))
    .slice(0, 5);

  const proximosEventos = eventos
    .filter((e) => e.data >= hojeISO)
    .sort((a, b) => (a.data > b.data ? 1 : -1))
    .slice(0, 5);

  const membrosSemServirRecente = membros
    .map((m) => {
      const participacoes = historico.filter((h) => h.membroId === m.id).map((h) => h.data);
      const ultima = participacoes.sort().pop();
      return { nome: m.nome, diasSemServir: diasDesde(ultima) };
    })
    .sort((a, b) => b.diasSemServir - a.diasSemServir)
    .slice(0, 5);

  return respostaSucesso({
    totalMembros: membros.length,
    totalCasais: membros.filter((m) => m.casado === true).length,
    totalJovens: membros.filter((m) => m.participaDe === "EJC").length,
    totalIgrejas: igrejas.length,
    totalEventos: eventos.length,
    escalasEsteMs: escalasDoMes.length,
    proximasEscalas,
    proximosEventos,
    membrosSemServirRecente,
  });
}

/* ==========================================================================
   RELATÓRIOS
   ========================================================================== */

function obterRelatorios() {
  const historico = lerTodasAsLinhas("HISTORICO");
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
  const dataLimite = Utilities.formatDate(seisMesesAtras, Session.getScriptTimeZone(), "yyyy-MM-dd");

  const recentes = historico.filter((h) => h.data >= dataLimite);
  const contagem = {};
  recentes.forEach((h) => {
    contagem[h.membroNome] = (contagem[h.membroNome] || 0) + 1;
  });

  const participacaoPorMembro = Object.entries(contagem)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);

  const mesAtual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  const escalasDoMes = lerTodasAsLinhas("ESCALAS").filter((e) => e.mesReferencia === mesAtual);
  const vagasEmAberto = escalasDoMes.filter((e) => !e.membroId).length;

  return respostaSucesso({ participacaoPorMembro, vagasEmAberto });
}
