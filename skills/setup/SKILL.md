---
name: setup
description: >
  Configura o plugin stark-export pela primeira vez: copia o credentials.json
  do Google, salva o token do Figma e verifica o ClickUp. Rode uma vez após
  instalar o plugin, ou novamente para atualizar credenciais.
user-invocable: true
---

# /stark-export:setup

Configuração única. O servidor figma-drive já vem pronto no plugin (sem `npm install`, sem build) — só faltam as credenciais.

## O que configura

| Item | Onde fica |
|---|---|
| `credentials.json` (Google service account) | `~/.stark-export/credentials.json` |
| Token do Figma | `~/.stark-export/config.json` |

## Execução

⚠️ Sem subagentes — executar inline. Perguntas em texto livre.

1. **Node.js** — rodar `node --version`. Se < 18 ou ausente: instruir instalação (nodejs.org, versão LTS) e parar.

2. **credentials.json** — perguntar onde está (padrão: Desktop).
   - Windows: `C:\Users\$env:USERNAME\Desktop\credentials.json` · Mac: `~/Desktop/credentials.json`
   - Verificar que existe e que o JSON tem `client_email` e `private_key`. Não existir → perguntar o caminho correto.
   - Criar a pasta `~/.stark-export/` e copiar para `~/.stark-export/credentials.json`.
   - Quem não tem o arquivo: pedir ao responsável pelo Drive da Stark.

3. **Token do Figma** — perguntar o token (gerar em: Figma → Settings → Security → Personal access tokens, escopo File content: Read).
   - Gravar `~/.stark-export/config.json`:
     ```json
     { "figma_token": "figd_..." }
     ```
   - Token já existente no arquivo e usuário não quer trocar → manter.

4. **ClickUp** — verificar se o MCP clickup está conectado (alguma tool `clickup_*` disponível).
   - Não conectado → orientar: definir a variável de ambiente `CLICKUP_API_TOKEN` (ClickUp → Settings → Apps → API Token) e reiniciar o Claude Code.

5. **Resumo** — exibir:
   ```
   ✅ stark-export configurado!
      credentials.json: ~/.stark-export/credentials.json
      Token Figma:      salvo
      ClickUp:          [ok | configurar CLICKUP_API_TOKEN]

   ⚠️ Reinicie o Claude Code para ativar o MCP figma-drive.
   Depois é só rodar: /stark-export:exportar [link do Figma]
   ```

## Verificação pós-restart (opcional)

Se o usuário quiser testar após reiniciar: chamar `upload_to_drive` com `dryRun: true`, `clientName` de um cliente real e `date` de hoje — confirma credenciais Google e acesso à pasta Clientes sem subir nada.
