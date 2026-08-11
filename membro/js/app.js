/* ==========================================================================
   app.js (app do Membro)
   Ponto de entrada do app do Membro. Só conhece telas e funções da área
   do membro — nada de coordenador aqui.
   ========================================================================== */

const App = {
  async abrirPainelDoMembro() {
    document.getElementById("saudacao-membro").textContent = `Olá, ${Auth.membroLogado.nome.split(" ")[0]}!`;
    await Members.carregarPainelMembro();
    UI.reiniciarHistorico();
    UI.navegarPara("tela-membro-dashboard", { empilhar: false });
  },
};

document.addEventListener("DOMContentLoaded", iniciar);

async function iniciar() {
  UI.aplicarTemaSalvo();
  _registrarServiceWorker();
  _ligarNavegacaoComCarregamentoDeDados();
  _ligarAjustes();

  const inicioSplash = Date.now();
  const sessaoRestaurada = await Auth.restaurarSessao();

  const tempoDecorrido = Date.now() - inicioSplash;
  const tempoRestante = Math.max(0, CONFIG.DURACAO_SPLASH_MS - tempoDecorrido);
  await new Promise((resolve) => setTimeout(resolve, tempoRestante));

  document.getElementById("splash-screen").classList.add("oculto");

  if (sessaoRestaurada) {
    await App.abrirPainelDoMembro();
  } else {
    UI.navegarPara("tela-inicial", { empilhar: false });
  }
}

function _registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((erro) => {
      console.warn("[app-membro] falha ao registrar service worker:", erro);
    });
  });
}

function _ligarNavegacaoComCarregamentoDeDados() {
  const carregadoresPorTela = {
    "tela-minhas-escalas": () => Members.carregarMinhasEscalas(),
    "tela-disponibilidade": () => Members.carregarDisponibilidade(),
    "tela-historico-membro": () => Members.carregarHistoricoPessoal(),
  };

  document.addEventListener("click", (evento) => {
    const alvo = evento.target.closest("[data-navegar]");
    if (!alvo) return;
    const carregador = carregadoresPorTela[alvo.dataset.navegar];
    if (carregador) carregador();
  });
}

function _ligarAjustes() {
  document.getElementById("toggle-tema-escuro")?.addEventListener("change", (evento) => {
    UI.alternarTema(evento.target.checked);
  });
}
