---
name: exportar
description: >
  Exporta agendas do Figma para o Google Drive e notifica pelo ClickUp.
  Use quando terminar uma arte no Figma: cole o link do frame, a skill revisa a
  arte (gramática e nudez), exporta como PNG, sobe na pasta certa do Drive,
  comenta o link na tarefa do ClickUp e muda o status para ENVIO PENDENTE.
user-invocable: true
---

# /stark-export:exportar

Recebe link(s) do Figma → revisão da Bia (gramática + nudez) → exporta PNG → sobe no Drive → comenta e atualiza o ClickUp.

## Uso

```
/stark-export:exportar https://www.figma.com/design/ABC/arquivo?node-id=1038-6
/stark-export:exportar          ← sem argumento: a skill pede os links
/stark-export:exportar --dry-run [link]   ← só confere a pasta destino no Drive, não sobe nada
```

Vários de uma vez (um por linha, nome do frame opcional após `|`):

```
/stark-export:exportar
https://figma.com/design/...?node-id=10-2 | 09-06 - Dr. Álvaro Rodrigues
https://figma.com/design/...?node-id=10-8 | 10-06 - Dra. Ana Silva
```

## Execução

⚠️ **Sem subagentes** — executar tudo inline nesta sessão.
⚠️ **Nunca chamar o Figma MCP oficial** (`use_figma`, `get_metadata`, `get_screenshot`) — rate limit no plano View. Todo acesso ao Figma é via tools do MCP `figma-drive`.
⚠️ **Nunca usar AskUserQuestion** — perguntas sempre em texto livre, para não travar a fila.

### 0. Onboarding automático (primeira vez)

Se `~/.stark-export/config.json` ou `~/.stark-export/credentials.json` não existirem → rodar o setup inline **agora** (mesmas etapas de `${CLAUDE_PLUGIN_ROOT}/skills/setup/SKILL.md`), avisar que é só na primeira vez, e continuar o export na sequência (o MCP figma-drive lê as credenciais a cada chamada — não precisa reiniciar se o MCP já estiver carregado).

### 1. Coletar a fila

- Sem links no input → pedir: *"Cole o(s) link(s) do Figma (um por linha). Dica: selecione o frame e Ctrl/Cmd+L. Se quiser, já cole o nome do frame após `|`."*
- Cada link precisa de `node-id` na URL. Sem node-id → pedir para copiar o link com o frame selecionado.
- Para cada link sem nome de frame informado: perguntar *"Nome do frame? (ex: `09-06 - Dr. Álvaro Rodrigues`)"* — pedir todos de uma vez quando houver vários.
- O nome segue `[DATA] - [Nome do cliente]` (datas: `DD-MM`, `DD-MM-AA` ou `YYYY-MM-DD`).
- Se for **Reels** (designer mencionar ou nome indicar): perguntar se há `.mp4` local para subir junto e o caminho.

### 2. Config do cliente

Ler `${CLAUDE_PLUGIN_ROOT}/config/clientes.yaml` **uma vez** no início:
- `clickup_list_id` e `clickup_status_final`
- Para cada cliente da fila (fuzzy match no nome): `drive_nome` → `clientName`, `drive_pasta_ano_id` → `startFolderId`, `clickup_alias` → nome a usar na busca do ClickUp. Cliente fora do config → não passar `clientName` nem `startFolderId` (o tool usa o nome do frame).

### 3. Revisão de Arte — Bia (antes de exportar, sempre)

Para cada tarefa, chamar `review_figma_frame({ figmaUrl, mode: "auto" })` → retorna os textos extraídos + screenshot de cada card. Analisar:

**Gramática PT-BR — só erro grave bloqueia:** palavra escrita errada ("cirujia"), acento faltando em palavra comum ("medico", "publico", "voce"), pontuação que prejudica a leitura, troca de letras por som ("exsesso"). **NÃO bloquear por:** capitalização em títulos, gírias/informalidade intencional, abreviações ("Dr.", "CRM"), nomes próprios, emojis, números.

**Nudez (visual) — bloqueia:** mamilos visíveis (foto ou ilustração), genitais, nudez explícita. **NÃO bloquear por:** decote, roupa justa/transparente sem nudez, roupa cirúrgica/de banho, anatomia médica ilustrativa.

**Resultado:**
- **APROVADO** → `✅ Arte aprovada — [N] frame(s) verificado(s).` → exportar
- **REPROVADO** → bloqueia **só essa tarefa**; as demais da fila **seguem sendo exportadas**. Exibir em texto livre:

  ```
  🚫 Revisão reprovada — [CLIENTE] · [DD-MM]
  Problemas:
    ● [gramatica|nudez] · [frame] (node: [id]): [descrição] — Trecho: "[trecho]"
  Opções:
    [1] Corrigir no Figma e rodar /stark-export:exportar novamente
    [2] Exportar mesmo assim
  ```

  - `[2]` → exportar e anotar `exportado_sem_revisao` no resumo
  - Designer corrigiu e mandou seguir → reverificar **só o node reprovado**: `review_figma_frame({ figmaUrl, nodeIds: ["id"], includeImages: false })` (gramática) — não refazer a revisão inteira. Corrigido → exportar; ainda errado → exibir o bloco 🚫 de novo.

**Fallbacks:** screenshot indisponível → revisar só gramática e avisar; sem textos → revisar só imagem; ambos falharam → perguntar se autoriza exportar sem revisão.

### 4. Exportar + subir (1 chamada por tarefa)

```
figma_to_drive({
  figmaUrl: "[link]",
  frameName: "[DATA] - [Nome]",
  mode: "auto",                       // detecta carrossel sozinho
  clientName: "[drive_nome, se houver]",
  startFolderId: "[drive_pasta_ano_id, se houver]",
  extraFiles: ["[caminho.mp4, se Reels]"]
})
```

- Passar o **mesmo `mode`** que a revisão da Bia usou (a contagem de cards do review indica: 2+ cards = `"carrossel"`, senão `"single"`) — garante que o que foi revisado é o que será exportado.
- `--dry-run` no input → passar `dryRun: true` (só valida a navegação do Drive, pula Bia, ClickUp e upload).
- O retorno informa `mode` usado e `upload.folderLink`. Se a detecção parecer errada (ex: estático exportado como carrossel), reexecutar com `mode` explícito.
- **Re-rodar é seguro**: arquivo já no Drive com mesmo nome e tamanho → `action: "skipped"`; tamanho diferente → `action: "updated"` (substitui, sem duplicar). Refletir isso no resumo.
- Falha técnica → 1 retry → se falhar de novo, logar e **continuar a fila**. No resumo final, listar o que falhou.

### 5. Atualizar ClickUp (sequencial, nunca em paralelo)

1. `clickup_filter_tasks` na lista `clickup_list_id` (incluir subtarefas) → encontrar a subtarefa do cliente com a data do frame. Usar `clickup_alias` do config na busca, se existir.
   - Data não bate com nenhuma subtarefa → listar candidatas próximas e perguntar em texto qual usar. Confirmada → seguir com ela e avisar a designer para corrigir o nome do frame no Figma.
2. Ler os `assignees` da **tarefa-mãe** da subtarefa (para o @-mention; se não houver, omitir o prefixo).
3. `clickup_create_task_comment` — **obrigatório, antes do status**:
   `@[responsável] ✅ Agendas exportadas e enviadas para o Drive do cliente. 📁 [folderLink]`
4. Só após o comentário confirmado: `clickup_update_task` → status `clickup_status_final`.

### 6. Resumo final

Tabela: cliente · data · revisão (✅ / 🚫 / sem revisão) · modo (single/carrossel N cards) · link do Drive · status ClickUp · falhas (se houver).

## Erros comuns

| Erro | Ação |
|---|---|
| `FIGMA_TOKEN nao encontrado` / `credentials nao encontrado` | Orientar `/stark-export:setup` |
| `Pasta do cliente nao encontrada` | Conferir `drive_nome` no `config/clientes.yaml` ou se a pasta foi compartilhada com o service account |
| URL sem `node-id` | Pedir o link com o frame selecionado (Ctrl/Cmd+L) |
| Subtarefa ClickUp não encontrada | Listar candidatas e perguntar em texto |
