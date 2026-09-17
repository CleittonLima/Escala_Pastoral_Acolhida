# Atualização V2 — Casais, escala e troca

## O que foi alterado

- Cadastro de membro agora inclui apelido, sexo, categoria na escala, pastorais em múltipla escolha, igreja e horários preferidos.
- Um casal só é considerado na vaga **Casal** quando os dois membros estão ativos, marcados como casados, com sexos diferentes e vinculados mutuamente.
- Quem se cadastra primeiro como casado fica pendente sem problema. O segundo pode selecioná-lo ao se cadastrar; o coordenador também pode concluir ou corrigir o vínculo.
- A geração considera casal como unidade indivisível, respeita a disponibilidade dos dois e evita repetir a mesma igreja e horário do mês anterior se houver alternativa.
- Rascunhos são persistidos na aba `ESCALAS`; publicar novamente o mesmo mês é bloqueado para evitar duplicidade.
- Na revisão manual, um casal aparece em uma única opção. Uma vaga de casal pode receber outro casal ou dois solteiros de sexos diferentes em uma única alteração.

## Como publicar

1. Substitua os arquivos do site no seu repositório/GitHub Pages pelo conteúdo desta pasta.
2. No Google Apps Script, substitua todos os arquivos da pasta `appscript/` e faça uma **nova versão da implantação** do Web App.
3. Abra o painel de coordenador e atualize os cadastros antigos: informe sexo, categoria e faça os vínculos dos casais existentes.
4. Faça um teste com dois casais e dois jovens antes de publicar uma escala real.

As novas colunas são acrescentadas automaticamente à planilha na primeira execução; os dados existentes não são apagados.

## Observação importante

O acesso de membro continua usando somente telefone, como pedido inicialmente. Para uma versão posterior, é recomendado incluir confirmação por código/PIN para impedir que outra pessoa entre usando um telefone conhecido.
