/**
 * Notifications.gs
 * Leitura de notificações por destinatário (membro específico ou "todos",
 * usado para avisos administrativos) e marcação em lote como lidas.
 */

function obterNotificacoes(parametros) {
  const todas = lerTodasAsLinhas("NOTIFICACOES");
  const destinatario = parametros.destinatario;

  const filtradas = todas.filter(
    (n) => n.destinatario === destinatario || n.destinatario === "todos"
  );
  filtradas.sort((a, b) => (a.data < b.data ? 1 : -1));

  return respostaSucesso(filtradas);
}

function criarNotificacao(dados) {
  const notificacao = {
    id: gerarId("notif"),
    destinatario: dados.destinatario || "todos",
    tipo: dados.tipo || "Aviso",
    mensagem: dados.mensagem || "",
    data: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    lida: false,
  };
  inserirLinha("NOTIFICACOES", notificacao);
  return respostaSucesso(notificacao);
}

function atualizarNotificacoes(dados) {
  if (Array.isArray(dados.marcarLidas)) {
    const aba = obterAba("NOTIFICACOES");
    const cabecalhos = CABECALHOS_ABAS.NOTIFICACOES;
    const indiceId = cabecalhos.indexOf("id");
    const indiceLida = cabecalhos.indexOf("lida");
    const valores = aba.getDataRange().getValues();

    for (let i = 1; i < valores.length; i++) {
      if (dados.marcarLidas.includes(valores[i][indiceId])) {
        aba.getRange(i + 1, indiceLida + 1).setValue(true);
      }
    }
    return respostaSucesso({ atualizado: true });
  }

  if (!dados.id) return respostaErro("ID da notificação não informado.");
  const encontrada = atualizarLinhaPorId("NOTIFICACOES", dados);
  return encontrada ? respostaSucesso(dados) : respostaErro("Notificação não encontrada.");
}

/**
 * Gera lembretes automáticos "um dia antes de servir". Pensado para ser
 * chamado por um gatilho diário (Extensões > Acionadores) no Apps Script —
 * ver instrução no guia de instalação.
 */
function enviarLembretesDeVespera() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaISO = Utilities.formatDate(amanha, Session.getScriptTimeZone(), "yyyy-MM-dd");

  const escalasDeAmanha = lerTodasAsLinhas("ESCALAS").filter(
    (e) => e.data === amanhaISO && e.status === "publicada"
  );

  escalasDeAmanha.forEach((escala) => {
    inserirLinha("NOTIFICACOES", {
      id: gerarId("notif"),
      destinatario: escala.membroId,
      tipo: "Lembrete",
      mensagem: `Lembrete: amanhã você serve em ${escala.igrejaNome} (${escala.horario}).`,
      data: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      lida: false,
    });
  });
}
