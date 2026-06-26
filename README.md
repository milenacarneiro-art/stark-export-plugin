# stark-export

Plugin Claude Code da Stark Marketing: exporta agendas do Figma para o Google Drive e notifica pelo ClickUp.

**Cole o link do frame → o plugin faz o resto:**

```
Link do Figma → revisão da Bia (gramática + nudez) → PNG (detecta carrossel sozinho) → pasta certa no Drive → comentário + status no ClickUp
```

---

## Instalação

### 1. Instale o Node.js

Baixe a versão LTS em [nodejs.org](https://nodejs.org) e instale (se já tiver, pule).

### 2. Instale o plugin

Rode **estes dois comandos** (no terminal, ou colando no chat do Claude Code):

```
claude plugin marketplace add milenacarneiro-art/stark-export-plugin
claude plugin install stark-export@stark-export
```

Ao final, **reinicie o Claude Code**. Devem aparecer os comandos
`/stark-export:exportar` e `/stark-export:setup`.

> ⚠️ **Não peça "instala esse plugin" colando só o link.** Em texto livre o Claude
> às vezes inventa um comando local com nome qualquer (ex: `/alocar-arquivo-drive`)
> em vez de instalar o plugin — e aí falta o MCP, faltam os hooks e a máquina nunca
> recebe atualização. Use os comandos acima. Passo a passo completo (e como limpar
> um comando improvisado): [docs/instalar-plugin.md](docs/instalar-plugin.md).

A instalação vale pro usuário inteiro — funciona no app e no terminal. Para atualizar
depois, veja [docs/atualizar-plugin.md](docs/atualizar-plugin.md).

### 3. Conecte o ClickUp

No Claude Code: `/mcp` (ou Configurações → Conectores) → conectar **ClickUp**.

### 4. Peça o credentials.json

Peça o arquivo `credentials.json` ao responsável pelo Drive da Stark e salve no seu Desktop.

### 5. Gere o token do Figma

figma.com → Settings → Security → Personal access tokens → criar token (escopo File content: Read) → copie.

### 6. Rode o primeiro export

```
/stark-export:exportar [link do frame no Figma]
```

Na primeira vez, ele pergunta onde está o `credentials.json` e pede o token do Figma — responde e ele já exporta. Pronto.

---

## Como usar

Termine a arte no Figma, selecione o frame, copie o link (**Ctrl/Cmd+L**) e rode:

```
/stark-export:exportar https://www.figma.com/design/ABC/arquivo?node-id=1038-6
```

O nome do frame (cliente + data) é lido automaticamente do Figma — não precisa digitar nada. A skill faz tudo:

1. **Bia revisa a arte**: erros graves de gramática PT-BR e nudez. Reprovado → bloqueia só essa tarefa e mostra o problema (você escolhe: corrigir no Figma ou exportar mesmo assim)
2. Exporta o frame como PNG (carrossel → 1 PNG por card, automático)
3. Sobe no Drive em `Clientes / [cliente] / Cronograma de Conteúdo / Artes / [ano] / [mês] / [data]` — re-rodar é seguro: arquivo igual é pulado, arquivo alterado é substituído (nunca duplica)
4. Comenta o link da pasta na subtarefa do ClickUp, com @ do responsável
5. Muda o status para **ENVIO PENDENTE**

**Se a Bia reprovar:** corrija no Figma e mande seguir — ela reverifica só o que foi reprovado e libera a exportação.

**Vários de uma vez** — cole um link por linha:

```
/stark-export:exportar
https://figma.com/design/...?node-id=10-2
https://figma.com/design/...?node-id=10-8
```

**Reels com vídeo** — avise que é Reels e informe o caminho do `.mp4`; ele sobe junto com a capa.

### Convenção de nome dos frames

O frame no Figma deve se chamar:

```
[DATA] - [Nome do cliente]      →  27-05 - Dr. João Exemplo
```

Datas aceitas: `DD-MM`, `DD-MM-AA` ou `YYYY-MM-DD`. É desse nome que saem o cliente e a data usados no Drive e no ClickUp — frame fora do padrão, a skill pergunta antes de seguir.

---

## Atualizar o plugin

Saiu correção nova? Cole o prompt pronto de [docs/atualizar-plugin.md](docs/atualizar-plugin.md)
no chat do Claude Code — ele puxa a última versão do GitHub, confirma a versão e te lembra
de reiniciar.

---

## Configuração por cliente (opcional)

Só necessário se o nome da pasta no Drive for diferente do nome no frame, ou se o cliente tiver estrutura não-padrão. Edite [config/clientes.yaml](config/clientes.yaml):

```yaml
clientes:
  "Dr. João Exemplo":
    drive_nome: "Dr. João"          # nome exato da pasta no Drive
    drive_pasta_ano_id: "1ABC...xyz"   # ID da pasta do ano (estrutura não-padrão)
    clickup_alias: "João Exemplo"    # nome da subtarefa no ClickUp (se diferente do frame)
```

---

## Troubleshooting

| Problema | Solução |
|---|---|
| `FIGMA_TOKEN nao encontrado` | Rode `/stark-export:setup` |
| `credentials nao encontrado` | Rode `/stark-export:setup` e informe onde está o credentials.json |
| `Pasta do cliente nao encontrada` | Verifique o `drive_nome` em `config/clientes.yaml` ou peça para compartilhar a pasta Clientes com o service account |
| Link sem `node-id` | Selecione o frame no Figma antes de copiar o link (Ctrl/Cmd+L) |
| ClickUp não conecta | Conecte o conector ClickUp no Claude Code (`/mcp` ou Configurações → Conectores) |
| `/plugin isn't available in this environment` | Normal no app desktop — instale pelo menu **+ → Plugins** (ver passo 2) |
| figma-drive não aparece após setup | Reinicie o Claude Code (o MCP carrega na inicialização) |

---

*Stark Marketing · stark-export v1.1.4 · designer@starkmkt.com*
