/* ==========================================================================
   app.js (app do Coordenador)
   Ponto de entrada do app do Coordenador. Só conhece telas e funções
   administrativas — nada de área do membro aqui.
   ========================================================================== */

const App = {
  async abrirPainelAdmin() {
    document.getElementById("sidebar").hidden = false;
    await Dashboard.carregarPainelAdmin();
    UI.reiniciarHistorico();
    UI.navegarPara("tela-admin-dashboard", { empilhar: false });
  },
};

document.addEventListener("DOMContentLoaded", iniciar);

async function iniciar() {
  if (!CONFIG.URL_API || CONFIG.URL_API === "COLE_AQUI_A_URL_DO_APPS_SCRIPT") {
    document.body.innerHTML = `
      <div class="aviso-sem-url">
        <h2>⚙ Configuração necessária</h2>
        <p>A URL do Google Apps Script ainda não foi configurada.<br>
        Abra o arquivo <code>shared/js/config.js</code> e cole a URL do Web App.</p>
        <p>Consulte o <strong>GUIA_DE_INSTALACAO.md</strong> (Parte 4).</p>
      </div>`;
    return;
  }
  UI.aplicarTemaSalvo();
  _registrarServiceWorker();
  _ligarMenuLateral();
  _ligarNavegacaoComCarregamentoDeDados();
  _ligarConfiguracoes();

  const inicioSplash = Date.now();
  const sessaoRestaurada = await Auth.restaurarSessao();

  const tempoDecorrido = Date.now() - inicioSplash;
  const tempoRestante = Math.max(0, CONFIG.DURACAO_SPLASH_MS - tempoDecorrido);
  await new Promise((resolve) => setTimeout(resolve, tempoRestante));

  document.getElementById("splash-screen").classList.add("oculto");

  if (sessaoRestaurada) {
    await App.abrirPainelAdmin();
  } else {
    UI.navegarPara("tela-inicial", { empilhar: false });
  }
}

function _registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((erro) => {
      console.warn("[app-coordenador] falha ao registrar service worker:", erro);
    });
  });
}

function _ligarMenuLateral() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const btnMenu = document.getElementById("btn-menu");

  const abrir = () => {
    sidebar.classList.add("aberto");
    overlay.hidden = false;
  };
  const fechar = () => {
    sidebar.classList.remove("aberto");
    overlay.hidden = true;
  };

  btnMenu?.addEventListener("click", abrir);
  overlay?.addEventListener("click", fechar);

  // Marca o item ativo no menu e fecha a gaveta no celular após escolher.
  sidebar.querySelectorAll("[data-navegar]").forEach((item) => {
    item.addEventListener("click", () => {
      sidebar.querySelectorAll(".sidebar-item").forEach((i) => i.classList.remove("ativo"));
      item.classList.add("ativo");
      if (window.innerWidth < 900) fechar();
    });
  });
}

function _ligarNavegacaoComCarregamentoDeDados() {
  const carregadoresPorTela = {
    "tela-admin-dashboard": () => Dashboard.carregarPainelAdmin(),
    "tela-admin-membros": () => Admin.carregarMembros(),
    "tela-admin-igrejas": () => Churches.carregar(),
    "tela-admin-eventos": () => Events.carregar(),
    "tela-admin-gerar-escala": () => Scheduler.iniciarPainel(),
    "tela-admin-historico": () => Admin.carregarHistoricoGeral(),
    "tela-admin-relatorios": () => Admin.carregarRelatorios(),
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

  document.getElementById("btn-salvar-senha")?.addEventListener("click", async () => {
    const novaSenha = document.getElementById("nova-senha-admin").value;
    if (!novaSenha) return UI.mostrarToast("Digite a nova senha.");
    const resposta = await Api.atualizar("configuracoes", { novaSenhaAdmin: novaSenha });
    document.getElementById("nova-senha-admin").value = "";
    UI.mostrarToast(resposta.sucesso ? "Senha atualizada!" : resposta.erro);
  });

  document.getElementById("btn-backup-exportar-admin")?.addEventListener("click", () => Admin.exportarBackup());
}
