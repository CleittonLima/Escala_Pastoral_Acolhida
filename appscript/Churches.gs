/**
 * Churches.gs
 * CRUD de IGREJAS: nome, padroeiro, comunidade, endereço, horários e
 * quantidade necessária de casais/jovens/adultos por vaga.
 */

function obterIgrejas(parametros) {
  const igrejas = lerTodasAsLinhas("IGREJAS");
  if (parametros.id) {
    const igreja = igrejas.find((i) => i.id === parametros.id);
    return igreja ? respostaSucesso(igreja) : respostaErro("Igreja não encontrada.");
  }
  return respostaSucesso(igrejas);
}

function criarIgreja(dados) {
  if (!dados.nome) return respostaErro("Nome da igreja é obrigatório.");
  const igreja = {
    id: gerarId("igr"),
    nome: dados.nome,
    padroeiro: dados.padroeiro || "",
    comunidade: dados.comunidade || "",
    endereco: dados.endereco || "",
    horarios: dados.horarios || "",
    minutosChegada: Number(dados.minutosChegada) || 30,
    qtdCasais: Number(dados.qtdCasais) || 0,
    qtdJovens: Number(dados.qtdJovens) || 0,
    qtdAdultos: Number(dados.qtdAdultos) || 0,
    observacoes: dados.observacoes || "",
  };
  inserirLinha("IGREJAS", igreja);
  return respostaSucesso(igreja);
}

function atualizarIgreja(dados) {
  if (!dados.id) return respostaErro("ID da igreja não informado.");
  dados.qtdCasais = Number(dados.qtdCasais) || 0;
  dados.qtdJovens = Number(dados.qtdJovens) || 0;
  dados.qtdAdultos = Number(dados.qtdAdultos) || 0;
  if (dados.minutosChegada !== undefined) dados.minutosChegada = Number(dados.minutosChegada) || 0;
  const encontrada = atualizarLinhaPorId("IGREJAS", dados);
  return encontrada ? respostaSucesso(dados) : respostaErro("Igreja não encontrada.");
}

function removerIgreja(id) {
  const encontrada = removerLinhaPorId("IGREJAS", id);
  return encontrada ? respostaSucesso({ removido: true }) : respostaErro("Igreja não encontrada.");
}
