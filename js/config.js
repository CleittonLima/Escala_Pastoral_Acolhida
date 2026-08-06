/* ==========================================================================
   config.js
   Configurações globais do sistema. Único arquivo que precisa ser editado
   para conectar o front-end à planilha (após publicar o Apps Script).
   ========================================================================== */

const CONFIG = {
  // Cole aqui a URL do Web App publicado no Google Apps Script (Code.gs).
  // Exemplo: "https://script.google.com/macros/s/AKfycb.../exec"
  URL_API: "https://script.google.com/macros/s/AKfycbzBjkJYlaRpPaX5Hja8QoHVFCeQ5lgarrn7kcBSGMULvqZirwYOSQa6CnaDyUITOfyQ1g/exec",

  NOME_APP: "Escala Pastoral do Rosário",
  NOME_CURTO: "Escala Rosário",

  // Duração da splash screen em milissegundos.
  DURACAO_SPLASH_MS: 1600,

  // Chaves usadas no localStorage — SOMENTE preferências locais
  // (tema, sessão do dispositivo). Dados do sistema NUNCA ficam aqui.
  CHAVES_LOCAL: {
    TEMA: "escalaRosario_tema",
    COR_PERSONALIZADA: "escalaRosario_corPersonalizada",
    SESSAO_MEMBRO: "escalaRosario_sessaoMembroId",
    SESSAO_ADMIN: "escalaRosario_sessaoAdmin",
  },

  // Dias da semana usados na disponibilidade mensal.
  DIAS_DISPONIBILIDADE: [
    { chave: "quinta", rotulo: "Quinta-feira" },
    { chave: "sabado", rotulo: "Sábado" },
    { chave: "domingoManha", rotulo: "Domingo de Manhã" },
    { chave: "domingoNoite", rotulo: "Domingo à Noite" },
  ],

  // Igrejas conhecidas para preferência de cadastro (também vêm da planilha,
  // esta lista é só um fallback caso a API ainda não tenha respondido).
  IGREJAS_PADRAO: [
    "Matriz",
    "São Cristóvão",
    "Nossa Senhora da Conceição",
    "Sem preferência",
  ],
};

// Congelado para evitar alterações acidentais em tempo de execução.
Object.freeze(CONFIG);
