---
name: exportar
description: >
  Exporta agendas do Figma para o Google Drive e notifica pelo ClickUp.
  Use quando terminar uma arte no Figma: cole o link do frame, a skill exporta
  como PNG, sobe na pasta certa do Drive, comenta o link na tarefa do ClickUp
  e muda o status para ENVIO PENDENTE.
user-invocable: true
---

# /stark-export:exportar

Recebe link(s) do Figma → exporta PNG → sobe no Drive → comenta e atualiza o ClickUp.

## Uso

```
/stark-export:exportar https://www.figma.com/design/ABC/arquivo?node-id=1038-6
/stark-export:exportar          ← sem argumento: a skill pede os links
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

### 1. Coletar a fila

- Sem links no input → pedir: *"Cole o(s) link(s) do Figma (um por linha). Dica: selecione o frame e Ctrl/Cmd+L. Se quiser, já cole o nome do frame após `|`."*
- Cada link precisa de `node-id` na URL. Sem node-id → pedir para copiar o link com o frame selecionado.
- Para cada link sem nome de frame informado: perguntar *"Nome do frame? (ex: `09-06 - Dr. Álvaro Rodrigues`)"* — pedir todos de uma vez quando houver vários.
- O nome segue `[DATA] - [Nome do cliente]` (datas: `DD-MM`, `DD-MM-AA` ou `YYYY-MM-DD`).
- Se for **Reels** (designer mencionar ou nome indicar): perguntar se há `.mp4` local para subir junto e o caminho.

### 2. Config do cliente

Ler `${CLAUDE_PLUGIN_ROOT}/config/clientes.yaml` **uma vez** no início:
- `clickup_list_id` e `clickup_status_final`
- Para cada cliente da fila (fuzzy match no nome): `drive_nome` → `clientName`, `drive_pasta_ano_id` → `startFolderId`. Cliente fora do config → não passar `clientName` nem `startFolderId` (o tool usa o nome do frame).

### 3. Exportar + subir (1 chamada por tarefa)

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

- O retorno informa `mode` usado e `upload.folderLink`. Se a detecção parecer errada (ex: estático exportado como carrossel), reexecutar com `mode: "single"` ou `"carrossel"`.
- Falha técnica → 1 retry → se falhar de novo, logar e **continuar a fila**. No resumo final, listar o que falhou.

### 4. Atualizar ClickUp (sequencial, nunca em paralelo)

1. `clickup_filter_tasks` na lista `clickup_list_id` (incluir subtarefas) → encontrar a subtarefa do cliente com a data do frame.
   - Data não bate com nenhuma subtarefa → listar candidatas próximas e perguntar em texto qual usar. Confirmada → seguir com ela e avisar a designer para corrigir o nome do frame no Figma.
2. `clickup_create_task_comment` — **obrigatório, antes do status**:
   `✅ Agendas exportadas e enviadas para o Drive do cliente. 📁 [folderLink]`
3. Só após o comentário confirmado: `clickup_update_task` → status `clickup_status_final`.

### 5. Resumo final

Tabela: cliente · data · modo (single/carrossel N cards) · link do Drive · status ClickUp · falhas (se houver).

## Erros comuns

| Erro | Ação |
|---|---|
| `FIGMA_TOKEN nao encontrado` / `credentials nao encontrado` | Orientar `/stark-export:setup` |
| `Pasta do cliente nao encontrada` | Conferir `drive_nome` no `config/clientes.yaml` ou se a pasta foi compartilhada com o service account |
| URL sem `node-id` | Pedir o link com o frame selecionado (Ctrl/Cmd+L) |
| Subtarefa ClickUp não encontrada | Listar candidatas e perguntar em texto |
