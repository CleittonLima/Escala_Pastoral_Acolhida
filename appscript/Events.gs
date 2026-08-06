/**
 * Events.gs
 * CRUD de EVENTOS extraordinários (Novena, Padroeiro, Terço das Crianças,
 * RCC, Retiro, Missão, Celebrações, etc.).
 */

function obterEventos(parametros) {
  const eventos = lerTodasAsLinhas("EVENTOS");
  if (parametros.id) {
    const evento = eventos.find((e) => e.id === parametros.id);
    return evento ? respostaSucesso(evento) : respostaErro("Evento não encontrado.");
  }
  return respostaSucesso(eventos);
}

function criarEvento(dados) {
  if (!dados.nome || !dados.data) return respostaErro("Nome e data do evento são obrigatórios.");
  const evento = {
    id: gerarId("evt"),
    nome: dados.nome,
    data: dados.data,
    hora: dados.hora || "",
    local: dados.local || "",
    qtdCasais: Number(dados.qtdCasais) || 0,
    qtdJovens: Number(dados.qtdJovens) || 0,
    qtdAdultos: Number(dados.qtdAdultos) || 0,
    observacoes: dados.observacoes || "",
  };
  inserirLinha("EVENTOS", evento);
  return respostaSucesso(evento);
}

function atualizarEvento(dados) {
  if (!dados.id) return respostaErro("ID do evento não informado.");
  dados.qtdCasais = Number(dados.qtdCasais) || 0;
  dados.qtdJovens = Number(dados.qtdJovens) || 0;
  dados.qtdAdultos = Number(dados.qtdAdultos) || 0;
  const encontrado = atualizarLinhaPorId("EVENTOS", dados);
  return encontrado ? respostaSucesso(dados) : respostaErro("Evento não encontrado.");
}

function removerEvento(id) {
  const encontrado = removerLinhaPorId("EVENTOS", id);
  return encontrado ? respostaSucesso({ removido: true }) : respostaErro("Evento não encontrado.");
}
