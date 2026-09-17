/* ==========================================================================
   helpers.js
   Funções utilitárias pequenas, usadas por mais de um módulo e nos dois
   apps (Membro e Coordenador). Ficam aqui para nunca faltar em um dos
   dois — antes, algumas dessas funções só existiam no app do Membro e
   quebravam o app do Coordenador silenciosamente (ex.: a tela "Gerar
   Escala" ficava em branco porque usava uma função que não existia ali).
   ========================================================================== */

/** Escapa texto antes de inserir em innerHTML, evitando HTML acidental/quebrado. */
function _escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

/** Mês de referência atual no formato "AAAA-MM". */
function _mesReferenciaAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

/** Nome por extenso de um mês de referência "AAAA-MM", ex.: "Agosto de 2026". */
function _nomeMes(mesReferencia) {
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const [ano, mes] = mesReferencia.split("-");
  return `${nomes[parseInt(mes, 10) - 1]} de ${ano}`;
}

/**
 * Aplica máscara de telefone brasileiro "(00) 00000-0000" (ou "(00) 0000-0000"
 * para fixo) enquanto o usuário digita. Uso: `Mascaras.telefone(inputEl)`.
 */
const Mascaras = {
  telefone(inputEl) {
    inputEl.addEventListener("input", () => {
      let digitos = inputEl.value.replace(/\D/g, "").slice(0, 11);
      let formatado = digitos;

      if (digitos.length > 10) {
        formatado = digitos.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
      } else if (digitos.length > 6) {
        formatado = digitos.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
      } else if (digitos.length > 2) {
        formatado = digitos.replace(/(\d{2})(\d{0,5})/, "($1) $2");
      } else if (digitos.length > 0) {
        formatado = digitos.replace(/(\d{0,2})/, "($1");
      }

      inputEl.value = formatado.replace(/-$/, "").replace(/\)\s$/, ")");
    });
    inputEl.setAttribute("maxlength", "15");
    inputEl.setAttribute("placeholder", "(00) 00000-0000");
    inputEl.setAttribute("inputmode", "tel");
  },
};

/** Debounce simples: só executa `fn` depois de `atrasoMs` sem novas chamadas. */
function debounce(fn, atrasoMs = 600) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), atrasoMs);
  };
}
