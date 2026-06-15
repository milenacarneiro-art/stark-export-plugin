# Atualizar o stark-export para a última versão

Quando sair correção ou novidade (avisada no grupo), atualize seu plugin.
**Copie o bloco abaixo e cole no chat do Claude Code** — ele faz o resto:

---

```
Atualiza meu plugin stark-export pra última versão que está no GitHub.

Marketplace/repo: milenacarneiro-art/stark-export-plugin

Faz o seguinte, em ordem, e me mostra a saída de cada passo:

1. Confere se o CLI do Claude Code está disponível: roda `claude --version`.
   Se NÃO estiver (comando não encontrado), PARA aqui e me avisa que eu preciso
   atualizar pelo app desktop — botão + → Plugins → stark-export → Update — e
   reiniciar. Não tenta nenhuma gambiarra com git nas pastas do plugin.

2. Refresca o marketplace (puxa a última versão do GitHub):
   claude plugin marketplace update stark-export

3. Atualiza o plugin:
   claude plugin update stark-export@stark-export

4. Confirma a versão instalada:
   claude plugin list
   — me mostra a linha do stark-export. Tem que estar em 1.1.0 ou maior.

5. Me lembra de REINICIAR o Claude Code pra aplicar — o MCP figma-drive e os
   hooks só recarregam na inicialização.

6. Depois que eu reiniciar: se aparecer um aviso de que o stark-export não está
   configurado, é só rodar /stark-export:setup uma vez. Se já estava configurado,
   não preciso fazer nada — minhas credenciais ficam em ~/.stark-export/ e não são
   tocadas pela atualização.
```

---

## Por que esses passos

- **`marketplace update` antes do `plugin update`:** o Claude Code guarda uma cópia
  local do marketplace. Sem refrescar, o `update` não enxerga os commits novos.
- **Restart obrigatório:** o servidor MCP `figma-drive` e os hooks carregam só na
  inicialização do Claude Code.
- **Suas credenciais não somem:** ficam em `~/.stark-export/` (token Figma + Google),
  fora da pasta do plugin. Atualizar não mexe nelas.

## Não tem o CLI `claude`? (maioria que instalou pelo app desktop)

Atualize pela interface, sem chat:

1. Botão **+** ao lado da caixa de mensagem → **Plugins**
2. Abra **stark-export** → **Update** (ou remova e instale de novo)
3. **Reinicie** o Claude Code

> O `/plugin` digitado no chat não funciona no app desktop — use o menu **+ → Plugins**.
