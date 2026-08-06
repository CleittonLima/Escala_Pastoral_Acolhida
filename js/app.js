/* ==========================================================================
   app.js
   Ponto de entrada da aplicação. Orquestra a inicialização: splash screen,
   registro do Service Worker (PWA), aplicação do tema salvo, restauração
   de sessão e navegação inicial. Também liga as telas de navegação
   inferior aos carregadores de dados de cada módulo.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", iniciarAplicacao);

async function iniciarAplicacao() {
  UI.aplicarTemaSalvo();
  _registrarServiceWorker();
  _ligarNavegacaoComCarregamentoDeDados();
  _ligarConfiguracoes();

  const inicioSplash = Date.now();

  const tipoSessao = await Auth.restaurarSessao();

  // Garante que a splash screen fique visível pelo tempo mínimo configurado,
  // mesmo que a checagem de sessão seja instantânea (evita "flash" na tela).
  const tempoDecorrido = Date.now() - inicioSplash;
  const tempoRestante = Math.max(0, CONFIG.DURACAO_SPLASH_MS - tempoDecorrido);
  await new Promise((resolve) => setTimeout(resolve, tempoRestante));

  document.getElementById("splash-screen").classList.add("oculto");

  if (tipoSessao === "membro") {
    document.getElementById("saudacao-membro").textContent = `Olá, ${Auth.membroLogado.nome.split(" ")[0]}!`;
    await Members.carregarPainelMembro();
    UI.navegarPara("tela-membro-dashboard", { empilhar: false });
  } else if (tipoSessao === "admin") {
    await Dashboard.carregarPainelAdmin();
    UI.navegarPara("tela-admin-dashboard", { empilhar: false });
  } else {
    UI.navegarPara("tela-inicial", { empilhar: false });
  }
}

function _registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((erro) => {
      console.warn("[app] falha ao registrar service worker:", erro);
    });
  });
}

/* Conecta cada botão de navegação ao carregamento de dados da tela de destino. */
function _ligarNavegacaoComCarregamentoDeDados() {
  const carregadoresPorTela = {
    "tela-minhas-escalas": () => Members.carregarMinhasEscalas(),
    "tela-disponibilidade": () => Members.carregarDisponibilidade(),
    "tela-historico-membro": () => Members.carregarHistoricoPessoal(),
    "tela-admin-membros": () => Admin.carregarMembros(),
    "tela-admin-igrejas": () => Churches.carregar(),
    "tela-admin-eventos": () => Events.carregar(),
    "tela-admin-gerar-escala": () => Scheduler.iniciarPainel(),
    "tela-admin-historico": () => Admin.carregarHistoricoGeral(),
    "tela-admin-relatorios": () => Admin.carregarRelatorios(),
    "tela-admin-configuracoes": () => Admin.carregarConfigAdmin(),
    "tela-admin-dashboard": () => Dashboard.carregarPainelAdmin(),
  };

  document.addEventListener("click", (evento) => {
    const alvo = evento.target.closest("[data-navegar]");
    if (!alvo) return;
    const carregador = carregadoresPorTela[alvo.dataset.navegar];
    if (carregador) carregador();
  });
}

function _ligarConfiguracoes() {
  document.getElementById("toggle-tema-escuro")?.addEventListener("change", (evento) => {
    UI.alternarTema(evento.target.checked);
  });

  document.getElementById("btn-backup-exportar")?.addEventListener("click", () => {
    if (Auth.sessaoAtiva === "admin") {
      Admin.exportarBackup();
    } else {
      UI.mostrarToast("Somente o administrador pode exportar o backup completo.");
    }
  });
}
