# Instalar o stark-export (primeira vez)

⚠️ **Não cole o link do GitHub no chat pedindo "instala isso".** Quando a
instalação é feita em texto livre, o Claude *interpreta* o pedido e às vezes,
em vez de instalar o plugin, inventa um comando local com um nome qualquer
(ex: `/alocar-arquivo-drive`). Esse comando improvisado **não tem o MCP
figma-drive, nem os hooks, nem as regras do pipeline, e nunca recebe
atualização** — parece o stark-export, mas não é.

Use **os comandos exatos abaixo**. Eles são determinísticos: todo mundo cai
nos mesmos `/stark-export:exportar` e `/stark-export:setup`.

---

## Passo a passo

**Copie o bloco abaixo e cole no chat do Claude Code** — ele roda os comandos
exatos, sem improvisar:

```
Instala o plugin stark-export rodando EXATAMENTE estes comandos, sem inventar
nada, me mostrando a saída de cada passo:

1. Confere o CLI: `claude --version`.
   Se NÃO existir (comando não encontrado), me avisa e para — sem o CLI não dá
   pra instalar pelo chat; me chama que a gente resolve junto.

2. Adiciona o marketplace:
   claude plugin marketplace add milenacarneiro-art/stark-export-plugin

3. Instala o plugin:
   claude plugin install stark-export@stark-export

4. Confirma a instalação:
   claude plugin list
   — tem que aparecer uma linha `stark-export` com a versão.

5. Me lembra de REINICIAR o Claude Code (fechar e abrir) — o MCP figma-drive e
   os hooks só carregam na inicialização.

NÃO crie nenhum comando, skill ou arquivo local "equivalente". Se algum passo
falhar, me mostra o erro e para — não tenta um caminho alternativo.
```

---

## Depois de reiniciar

- Os comandos `/stark-export:exportar` e `/stark-export:setup` devem aparecer.
- Vai surgir um aviso de que o plugin não está configurado → rode
  **`/stark-export:setup`** uma vez (token do Figma + credenciais do Google).
  Veja [credentials-google.md](credentials-google.md).
- O conector **ClickUp** precisa estar conectado (`/mcp`).

## Já tinha um comando improvisado antes? (ex: `/alocar-arquivo-drive`)

Se essa máquina já tinha rodado a instalação "no improviso", provavelmente o
Claude criou um skill/command solto em `~/.claude/`. Ele não atrapalha o
plugin, mas confunde — vale apagar:

```
Procura em ~/.claude/ (skills/ e commands/) qualquer skill ou comando que você
tenha criado antes pra exportar Figma pro Drive (ex: alocar-arquivo-drive,
exportar, figma-drive) e remove. NÃO mexa em nada do plugin stark-export
instalado pelo plugin manager.
```

Confirme com `claude plugin list`: se `stark-export` aparece ali, o comando
certo é `/stark-export:exportar` — qualquer outro nome é resíduo do improviso.

## Por que esses comandos e não o link no chat

- **`marketplace add` + `plugin install`** registram o plugin no plugin
  manager. É isso que sobe o MCP figma-drive, ativa os hooks e — importante —
  liga essa máquina ao caminho de atualização (`claude plugin update`).
- **Sem o plugin manager, não há update.** Todo fix entregue ao time sobe a
  versão no `plugin.json` e é distribuído pelo `plugin update`. Quem rodou um
  comando improvisado fica congelado e nunca recebe correção.
- **O nome do comando é fixo:** vem do `name` do plugin (`stark-export`) +
  `name` de cada skill (`exportar`, `setup`). Instalado certo, é igual pra todo
  mundo — não tem como variar.

## Atualizar depois

Saiu correção nova? O caminho de atualização está em
[atualizar-plugin.md](atualizar-plugin.md).
