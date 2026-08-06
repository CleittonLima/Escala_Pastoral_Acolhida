# Guia de Instalação — Escala Pastoral do Rosário

Este guia assume que você **nunca usou Google Apps Script**. Siga os passos na ordem.

---

## PARTE 1 — Criar a planilha no Google Sheets

1. Acesse [sheets.google.com](https://sheets.google.com) e clique em **Planilha em branco**.
2. Renomeie a planilha para **"Escala Pastoral do Rosário - Dados"** (clique no título no canto superior esquerdo).
3. Não é necessário criar as abas manualmente — o sistema cria automaticamente **MEMBROS, ESCALAS, EVENTOS, IGREJAS, HISTORICO, DISPONIBILIDADE, CONFIGURACOES e NOTIFICACOES** (com todas as colunas) na primeira vez que o backend rodar. Você só precisa ter a planilha aberta para o próximo passo.

---

## PARTE 2 — Criar o projeto no Google Apps Script

1. Na planilha, clique em **Extensões → Apps Script**. Isso abre o editor já conectado a esta planilha (é essencial começar por aqui, e não pelo script.google.com direto, para que o script "enxergue" a planilha automaticamente).
2. Você verá um arquivo `Código.gs` vazio criado por padrão. Vamos substituir e criar todos os arquivos do projeto.
3. Para cada arquivo abaixo, crie um arquivo de script com o mesmo nome (menu **Arquivo → Novo → Script**, dê o nome sem a extensão `.gs` — o Apps Script adiciona sozinho) e cole o conteúdo correspondente da pasta `appscript/` deste projeto:
   - `Code` ← cole o conteúdo de `appscript/Code.gs`
   - `Config` ← cole o conteúdo de `appscript/Config.gs`
   - `Members` ← cole o conteúdo de `appscript/Members.gs`
   - `Churches` ← cole o conteúdo de `appscript/Churches.gs`
   - `Events` ← cole o conteúdo de `appscript/Events.gs`
   - `Scheduler` ← cole o conteúdo de `appscript/Scheduler.gs`
   - `Notifications` ← cole o conteúdo de `appscript/Notifications.gs`
   - `Utils` ← cole o conteúdo de `appscript/Utils.gs`
4. Apague o arquivo `Código.gs` padrão (clique nos três pontinhos ao lado dele → **Excluir**), já que seu conteúdo foi substituído pelos arquivos acima.
5. Clique no ícone de **disquete (Salvar projeto)** no topo.
6. Renomeie o projeto clicando em "Projeto sem título" no topo e digite **"Escala Pastoral do Rosário - Backend"**.

---

## PARTE 3 — Publicar como Web App

1. No editor do Apps Script, clique em **Implantar → Nova implantação** (botão azul no canto superior direito).
2. Clique no ícone de engrenagem ao lado de "Selecionar tipo" e escolha **App da Web**.
3. Preencha:
   - **Descrição**: "Versão 1"
   - **Executar como**: **Eu** (seu e-mail)
   - **Quem pode acessar**: **Qualquer pessoa** *(importante: precisa ser "Qualquer pessoa", não "Qualquer pessoa com Conta do Google", para que o site no GitHub Pages consiga chamar a API sem exigir login)*
4. Clique em **Implantar**.
5. A primeira vez pedirá autorização: clique em **Autorizar acesso**, escolha sua conta Google, e se aparecer uma tela dizendo "O Google não verificou este app", clique em **Configurações avançadas → Acessar Escala Pastoral do Rosário (não seguro)** — isso é normal para scripts pessoais/paroquiais que você mesmo criou.
6. Após autorizar, você verá uma tela com a **URL do app da Web**. Ela se parece com:
   `https://script.google.com/macros/s/AKfycb.../exec`
7. **Copie essa URL inteira** — você vai precisar dela no próximo passo.

> ⚠️ Sempre que você alterar o código do Apps Script depois, será preciso criar uma **Nova implantação** (ou usar "Gerenciar implantações → editar → Nova versão") para que as mudanças entrem em vigor. Simplesmente salvar o código não atualiza o app já publicado.

---

## PARTE 4 — Inserir a URL no projeto

1. Abra o arquivo `js/config.js` do projeto (na pasta `EscalaPastoralRosario` que você baixou).
2. Encontre a linha:
   ```js
   URL_API: "COLE_AQUI_A_URL_DO_APPS_SCRIPT",
   ```
3. Substitua pelo link copiado no passo anterior, por exemplo:
   ```js
   URL_API: "https://script.google.com/macros/s/AKfycbXXXXXXXXXXXXXXXXXXXX/exec",
   ```
4. Salve o arquivo.

---

## PARTE 5 — Adicionar as imagens (opcional, mas recomendado)

Dentro de `assets/logo/`, adicione (com esses nomes exatos):
- `logo-pastoral.png` — logo da Pastoral da Acolhida
- `logo-paroquia.png` — logo pequena da Paróquia (aparece no rodapé)
- `favicon.png` — ícone 192x192 usado como ícone do app instalado
- `splash-icon.png` — ícone 512x512 usado na splash screen/instalação

Se você não tiver essas imagens ainda, não tem problema: o sistema já foi programado para mostrar um ícone padrão automaticamente até que você as adicione.

---

## PARTE 6 — Criar o repositório no GitHub

1. Acesse [github.com](https://github.com) e faça login (ou crie uma conta gratuita).
2. Clique no **+** no canto superior direito → **New repository**.
3. Nome do repositório: `escala-pastoral-rosario` (pode ser outro nome, sem espaços).
4. Marque como **Public** (necessário para o GitHub Pages gratuito).
5. Clique em **Create repository**.

---

## PARTE 7 — Enviar os arquivos para o GitHub

**Opção mais simples (pelo navegador, sem instalar nada):**
1. No repositório recém-criado, clique em **uploading an existing file** (ou **Add file → Upload files**).
2. Arraste **toda a pasta** `EscalaPastoralRosario` (o conteúdo dela: `index.html`, `manifest.json`, `service-worker.js`, as pastas `css/`, `js/`, `assets/`, `appscript/`) para a área de upload.
   - Observação: o GitHub aceita arrastar pastas inteiras direto do navegador na maioria dos casos; se não funcionar, arraste os arquivos e recrie as subpastas digitando o caminho no nome do arquivo durante o upload (ex.: `css/style.css`).
3. Escreva uma mensagem de commit, ex.: "Primeira versão do sistema".
4. Clique em **Commit changes**.

---

## PARTE 8 — Ativar o GitHub Pages

1. No repositório, clique em **Settings** (aba superior).
2. No menu lateral, clique em **Pages**.
3. Em **Branch**, selecione `main` (ou `master`) e a pasta `/ (root)`.
4. Clique em **Save**.
5. Aguarde 1 a 2 minutos. Recarregue a página — aparecerá um link do tipo:
   `https://SEU-USUARIO.github.io/escala-pastoral-rosario/`
6. Esse é o endereço público do seu sistema. Pode compartilhar com a Pastoral!

---

## PARTE 9 — Testar o funcionamento completo

1. Abra o link do GitHub Pages no celular ou computador.
2. Você deve ver a splash screen, depois a tela inicial com a logo.
3. Toque em **⚙ Configurações → Acesso Administrativo**.
4. Senha padrão inicial: **`rosario2026`** — troque-a imediatamente em **Configurações do Sistema → Nova senha de administrador** depois do primeiro acesso.
5. Cadastre uma Igreja (em **Igrejas**), depois um Membro (em **Membros**) usando um telefone de teste.
6. Saia da área administrativa (**Configurações do Sistema → Sair**) e entre como membro usando o telefone cadastrado, para confirmar que o login de membro funciona.
7. Volte como administrador, vá em **Escala → Gerar Escala Automaticamente** e confirme que o rascunho aparece.

Se algo não funcionar, o erro mais comum é a **URL do Apps Script** copiada incorretamente em `js/config.js`, ou a implantação do Web App configurada como "Somente eu" em vez de "Qualquer pessoa" (Parte 3, passo 3).

---

## Como atualizar o sistema depois

- **Mudar o visual/telas (HTML/CSS/JS)**: edite os arquivos localmente e faça upload novamente pelo GitHub (**Add file → Upload files**, sobrescrevendo os arquivos existentes) — o GitHub Pages atualiza sozinho em 1-2 minutos.
- **Mudar a lógica do backend (arquivos `.gs`)**: edite no editor do Apps Script (**Extensões → Apps Script** na planilha) e depois **Implantar → Gerenciar implantações → ✏️ Editar → Nova versão → Implantar**, para que a URL publicada passe a usar o código novo.

---

## Lembrete automático de véspera (opcional)

Para que o sistema envie sozinho o "lembrete um dia antes de servir" todos os dias:
1. No editor do Apps Script, clique no ícone de relógio (**Acionadores**) no menu lateral esquerdo.
2. Clique em **+ Adicionar acionador**.
3. Função a executar: `enviarLembretesDeVespera`.
4. Origem do evento: **Baseado em tempo**.
5. Tipo de acionador baseado em tempo: **Timer diário**, escolha um horário (ex.: 18h–19h).
6. Clique em **Salvar**.
