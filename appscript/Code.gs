/**
 * Code.gs
 * Ponto de entrada do Web App do Google Apps Script. Recebe todas as
 * chamadas do front-end (via Fetch API) e roteia para o módulo correto
 * com base no parâmetro "recurso". GET é usado para leituras; POST é
 * usado para criar/atualizar/remover (o método real vem no campo
 * "metodo" do corpo da requisição — ver api.js no front-end).
 */

function doGet(e) {
  garantirEstruturaCompleta();

  try {
    const parametros = e.parameter || {};
    const recurso = parametros.recurso;

    switch (recurso) {
      case "membros":
        return obterMembros(parametros);
      case "igrejas":
        return obterIgrejas(parametros);
      case "eventos":
        return obterEventos(parametros);
      case "escalas":
        return obterEscalas(parametros);
      case "historico":
        return obterHistorico(parametros);
      case "disponibilidade":
        return obterDisponibilidade(parametros);
      case "notificacoes":
        return obterNotificacoes(parametros);
      case "configuracoes":
        return obterConfiguracoes(parametros);
      case "dashboard":
        return obterDashboard();
      case "relatorios":
        return obterRelatorios();
      default:
        return respostaErro(`Recurso desconhecido: ${recurso}`);
    }
  } catch (erro) {
    return respostaErro(`Erro no servidor: ${erro.message}`);
  }
}

function doPost(e) {
  garantirEstruturaCompleta();

  try {
    const corpo = JSON.parse(e.postData.contents);
    const { recurso, metodo, dados } = corpo;

    if (metodo === "PUT") return _rotearAtualizacao(recurso, dados);
    if (metodo === "DELETE") return _rotearRemocao(recurso, dados.id);
    return _rotearCriacao(recurso, dados);
  } catch (erro) {
    return respostaErro(`Erro no servidor: ${erro.message}`);
  }
}

function _rotearCriacao(recurso, dados) {
  switch (recurso) {
    case "membros":
      return criarMembro(dados);
    case "igrejas":
      return criarIgreja(dados);
    case "eventos":
      return criarEvento(dados);
    case "escalas":
      return criarEscala(dados);
    case "notificacoes":
      return criarNotificacao(dados);
    default:
      return respostaErro(`Recurso desconhecido para criação: ${recurso}`);
  }
}

function _rotearAtualizacao(recurso, dados) {
  switch (recurso) {
    case "membros":
      return atualizarMembro(dados);
    case "igrejas":
      return atualizarIgreja(dados);
    case "eventos":
      return atualizarEvento(dados);
    case "escalas":
      return atualizarEscala(dados);
    case "disponibilidade":
      return salvarDisponibilidade(dados);
    case "notificacoes":
      return atualizarNotificacoes(dados);
    case "configuracoes":
      return atualizarConfiguracoes(dados);
    default:
      return respostaErro(`Recurso desconhecido para atualização: ${recurso}`);
  }
}

function _rotearRemocao(recurso, id) {
  switch (recurso) {
    case "membros":
      return removerMembro(id);
    case "igrejas":
      return removerIgreja(id);
    case "eventos":
      return removerEvento(id);
    case "escalas":
      return removerEscala(id);
    default:
      return respostaErro(`Recurso desconhecido para remoção: ${recurso}`);
  }
}
