# stark-export — Plugin Context

Plugin mínimo: link do Figma → revisão da Bia (gramática + nudez) → PNG → Google Drive → comentário + status no ClickUp.

## Skills

| Skill | Quando usar |
|---|---|
| `/stark-export:exportar` | Terminou a arte no Figma — cola o link e exporta |
| `/stark-export:setup` | Primeira vez — configura credenciais |

## Regras críticas

1. **Sem subagentes** — pipeline inline na sessão principal
2. **Nunca chamar o Figma MCP oficial** — todo acesso ao Figma é via MCP `figma-drive` (REST com token próprio, sem rate limit de View seat)
3. **Comentário antes do status** — `clickup_create_task_comment` é bloqueante; `clickup_update_task` só depois de confirmado, nunca em paralelo
4. **Falha isolada** — 1 retry → logar → continuar a fila
5. **Nunca AskUserQuestion** — perguntas em texto livre para não travar a fila
6. **Bia REPROVADO** bloqueia **só essa tarefa** (gramática grave ou nudez) — as demais da fila seguem. Não é falha técnica, é decisão de qualidade. Review via tool `review_figma_frame` (REST), nunca via Figma MCP oficial

## Arquivos

```
config/clientes.yaml              ← clickup_list_id + overrides de Drive por cliente
hooks/hooks.json                  ← SessionStart hook (auto-descoberto pelo plugin)
hooks/check-setup.js              ← avisa se ~/.stark-export/ nao esta configurado
mcp-servers/figma-drive/          ← MCP server embutido (dist/ bundled, commitado)
~/.stark-export/credentials.json  ← service account Google (criado pelo setup)
~/.stark-export/config.json       ← token do Figma (criado pelo setup)
```

## Onboarding padronizado (hook)

`hooks/check-setup.js` roda em todo `SessionStart`. Se faltar `config.json` (token Figma)
ou `credentials.json` (Google) em `~/.stark-export/`, injeta um aviso (`systemMessage`) pedindo
`/stark-export:setup` — igual para todo mundo. **Nao bloqueia** nada e sai silencioso quando
configurado. Cross-platform via `node`. Editou o script → testar com `node hooks/check-setup.js`
(stdout vazio = configurado; JSON = falta setup).

## Desenvolvimento do MCP server

```
cd mcp-servers/figma-drive
npm install          # só para desenvolver
npm run typecheck
npm run build        # gera dist/index.js bundled — COMMITAR o dist
```

O `dist/index.js` é commitado de propósito: o time instala o plugin sem npm install.
