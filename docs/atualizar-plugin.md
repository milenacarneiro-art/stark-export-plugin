# Atualizar o stark-export para a última versão

Saiu correção nova (avisada no grupo)? Você instalou o plugin colando o link do
GitHub no chat e pedindo pra instalar — atualizar é o mesmo caminho, pelo chat.
**Copie o bloco abaixo e cole no chat do Claude Code** — ele faz o resto:

---

```
Atualiza meu plugin stark-export pra última versão que está no GitHub.

Marketplace: stark-export  (repo milenacarneiro-art/stark-export-plugin)

Faz o seguinte, me mostrando a saída de cada passo:

1. Confere se o CLI do Claude Code está disponível: roda `claude --version`.
   Se NÃO estiver (comando não encontrado), me avisa e para — sem o CLI não dá
   pra atualizar pelo chat; me chama que a gente resolve junto.

2. Refresca o marketplace (puxa a última versão do GitHub):
   claude plugin marketplace update stark-export

3. Atualiza o plugin:
   claude plugin update stark-export@stark-export

4. Confirma a versão instalada:
   claude plugin list
   — a linha do stark-export tem que mostrar 1.1.0 ou maior.

5. Me lembra de REINICIAR o Claude Code pra aplicar — o MCP figma-drive e os
   hooks só recarregam na inicialização.

6. Depois que eu reiniciar: se aparecer um aviso de que o stark-export não está
   configurado, é só rodar /stark-export:setup uma vez. Se já estava configurado,
   não preciso fazer nada — minhas credenciais ficam em ~/.stark-export/ e não são
   tocadas pela atualização.
```

---

## Por que esses passos

- **`marketplace update` antes do `plugin update`:** quando você instalou pelo link, o
  Claude Code guardou uma cópia local do repo (em `~/.claude/plugins/`). O
  `marketplace update` puxa os commits novos do GitHub pra essa cópia; sem isso, o
  `plugin update` não enxerga a versão nova.
- **Confirmar a versão (1.1.0+):** cada correção entregue ao time sobe o número da
  versão no `plugin.json`. Se o `claude plugin list` ainda mostra a versão antiga, o
  update não pegou — repita o passo 2 e 3.
- **Restart obrigatório:** o MCP `figma-drive` e os hooks carregam só na inicialização.
- **Suas credenciais não somem:** ficam em `~/.stark-export/` (token Figma + Google),
  fora da pasta do plugin. Atualizar não mexe nelas.

## Se as mudanças não aparecerem depois de reiniciar

- Confirme que reiniciou o Claude Code **por completo** (fechar e abrir de novo).
- Rode `claude plugin list` e veja se a versão é a esperada. Se não for, rode de novo:
  `claude plugin marketplace update stark-export` e `claude plugin update stark-export@stark-export`.
- Persistindo, me chama — pode ser preciso remover e reinstalar
  (`claude plugin uninstall stark-export@stark-export` e instalar de novo pelo link).
