# stark-export

Plugin Claude Code da Stark Marketing: exporta agendas do Figma para o Google Drive e notifica pelo ClickUp.

**Cole o link do frame → o plugin faz o resto:**

```
Link do Figma → revisão da Bia (gramática + nudez) → PNG (detecta carrossel sozinho) → pasta certa no Drive → comentário + status no ClickUp
```

---

## Instalação (3 passos)

### 1. Instale o plugin

Pelo canal da organização Stark no Claude Code (seção de plugins), ou via marketplace:

```
/plugin marketplace add milenacarneiro-art/stark-export-plugin
/plugin install stark-export
```

> Não precisa de `npm install`, build, yt-dlp nem ffmpeg. O servidor de export já vem pronto dentro do plugin. Só é necessário ter o **Node.js 18+** instalado ([nodejs.org](https://nodejs.org), versão LTS).

### 2. Tenha em mãos

| Item | Onde conseguir |
|---|---|
| `credentials.json` | Pedir ao responsável pelo Drive da Stark (service account do Google) |
| Token do Figma | figma.com → Settings → Security → Personal access tokens |
| Token do ClickUp | ClickUp → Settings → Apps → API Token → definir como variável de ambiente `CLICKUP_API_TOKEN` |

### 3. Rode o setup

```
/stark-export:setup
```

Ele copia o `credentials.json`, salva o token do Figma e confere o ClickUp. Depois, **reinicie o Claude Code** — pronto.

---

## Como usar

Termine a arte no Figma, selecione o frame, copie o link (**Ctrl/Cmd+L**) e rode:

```
/stark-export:exportar https://www.figma.com/design/ABC/arquivo?node-id=1038-6
```

A skill pergunta o nome do frame (ex: `09-06 - Dr. Álvaro Rodrigues`) e faz tudo:

1. **Bia revisa a arte**: erros graves de gramática PT-BR e nudez. Reprovado → bloqueia só essa tarefa e mostra o problema (você escolhe: corrigir no Figma ou exportar mesmo assim)
2. Exporta o frame como PNG (carrossel → 1 PNG por card, automático)
3. Sobe no Drive em `Clientes / [cliente] / Cronograma de Conteúdo / Artes / [ano] / [mês] / [data]`
4. Comenta o link da pasta na subtarefa do ClickUp
5. Muda o status para **ENVIO PENDENTE**

**Se a Bia reprovar:** corrija no Figma e mande seguir — ela reverifica só o que foi reprovado e libera a exportação.

**Vários de uma vez** — cole um link por linha (nome do frame opcional após `|`):

```
/stark-export:exportar
https://figma.com/design/...?node-id=10-2 | 09-06 - Dr. Álvaro Rodrigues
https://figma.com/design/...?node-id=10-8 | 10-06 - Dra. Ana Silva
```

**Reels com vídeo** — avise que é Reels e informe o caminho do `.mp4`; ele sobe junto com a capa.

### Convenção de nome dos frames

```
[DATA] - [Nome do cliente]      →  27-05 - Dr. Rodolfo Soares
```

Datas aceitas: `DD-MM`, `DD-MM-AA` ou `YYYY-MM-DD`.

---

## Configuração por cliente (opcional)

Só necessário se o nome da pasta no Drive for diferente do nome no frame, ou se o cliente tiver estrutura não-padrão. Edite [config/clientes.yaml](config/clientes.yaml):

```yaml
clientes:
  "Dr. Rodolfo Soares":
    drive_nome: "Dr. Rodolfo"          # nome exato da pasta no Drive
    drive_pasta_ano_id: "1ABC...xyz"   # ID da pasta do ano (estrutura não-padrão)
```

---

## Troubleshooting

| Problema | Solução |
|---|---|
| `FIGMA_TOKEN nao encontrado` | Rode `/stark-export:setup` |
| `credentials nao encontrado` | Rode `/stark-export:setup` e informe onde está o credentials.json |
| `Pasta do cliente nao encontrada` | Verifique o `drive_nome` em `config/clientes.yaml` ou peça para compartilhar a pasta Clientes com o service account |
| Link sem `node-id` | Selecione o frame no Figma antes de copiar o link (Ctrl/Cmd+L) |
| ClickUp não conecta | Defina a variável de ambiente `CLICKUP_API_TOKEN` e reinicie o Claude Code |
| figma-drive não aparece após setup | Reinicie o Claude Code (o MCP carrega na inicialização) |

---

*Stark Marketing · stark-export v1.0.0 · designer@starkmkt.com*
