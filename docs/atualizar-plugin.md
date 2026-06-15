# Atualizar o stark-export para a última versão

Saiu correção nova (avisada no grupo)? Atualize seu clone local do plugin.
**Copie o bloco abaixo e cole no chat do Claude Code** — ele faz o resto:

---

```
Atualiza meu repo local do stark-export-plugin pra última versão do main no GitHub.

Repo: https://github.com/milenacarneiro-art/stark-export-plugin

Faz o seguinte, me mostrando a saída de cada passo:

1. Acha a pasta do repo local — provavelmente uma pasta tipo "stark-export-plugin"
   ou "stark-export" no meu computador. Se não achar, me pergunta onde está. Entra nela.

2. Confere que é o repo certo: roda `git remote -v` — tem que apontar pra
   milenacarneiro-art/stark-export-plugin. Se não for, me avisa e para.

3. Salva qualquer mudança local em arquivos versionados (ex: se eu mexi no
   config/clientes.yaml): roda `git stash`. Meu config pessoal (token do Figma e
   credentials.json) fica em ~/.stark-export/, fora do repo, então não corre risco.

4. Garante que tô na branch main:
   git checkout main

5. Puxa a última versão:
   git fetch origin
   git pull origin main

6. Se rodou git stash no passo 3, mostra `git stash list` e me pergunta se eu quero
   recuperar (`git stash pop`) ou descartar.

7. Confirma que atualizou: roda `git log --oneline -3` e me mostra a versão em
   .claude-plugin/plugin.json — tem que estar em 1.1.0 ou maior.

8. NÃO precisa rodar npm install nem build — o dist/ já vem pronto no repo.

9. Me lembra de REINICIAR o Claude Code pra aplicar: o MCP figma-drive e os hooks
   só recarregam na inicialização.

10. Depois que eu reiniciar, se aparecer um aviso de que o stark-export não está
    configurado, é só rodar /stark-export:setup uma vez. Se já estava configurado,
    não preciso fazer nada.
```

---

## Por que esses passos

- **`git stash` antes do pull:** se você editou algum arquivo versionado (ex:
  `config/clientes.yaml`), o stash guarda sua mudança pra não dar conflito no pull.
  No Windows é comum o git acusar arquivos "modificados" só por causa de quebra de
  linha (CRLF) — o stash resolve isso também.
- **`dist/` já vem pronto:** o servidor MCP é commitado já buildado, então não precisa
  de `npm install` nem `npm run build`. Só puxar e reiniciar.
- **Restart obrigatório:** o MCP `figma-drive` e os hooks carregam só na inicialização
  do Claude Code.
- **Suas credenciais não somem:** ficam em `~/.stark-export/` (token Figma + Google),
  fora da pasta do repo. Atualizar não mexe nelas.

## Se as mudanças não aparecerem depois de reiniciar

Você pode ter instalado pelo **gerenciador de plugins** (marketplace) em vez de clone
git. Nesse caso, no chat do Claude Code:

```
claude plugin marketplace update stark-export
claude plugin update stark-export@stark-export
```

e reinicie. No app desktop sem CLI: menu **+ → Plugins → stark-export → Update**.
