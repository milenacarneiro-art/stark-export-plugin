# Gerar o `credentials.json` do Google (conta de serviço)

Este arquivo é a **chave de uma conta de serviço (service account)** — não é login pessoal.
O `/stark-export:setup` valida que ele tem os campos `client_email` e `private_key`.

> ⚠️ O `credentials.json` é uma **senha**: não mandar em grupo público, não commitar no Git.

---

## Passo a passo

### 1. Abrir o Google Cloud Console
- Acesse https://console.cloud.google.com
- Faça login com a conta Google da Stark que tem acesso ao Drive dos clientes.

### 2. Criar (ou escolher) um projeto
- No topo, clique no seletor de projeto → **Novo projeto**.
- Nome: `stark-export` (ou usar um projeto existente da Stark).
- Criar e selecionar esse projeto.

### 3. Ativar a API do Google Drive
- Menu (☰) → **APIs e serviços** → **Biblioteca**.
- Busque **Google Drive API** → clique → **Ativar**.

### 4. Criar a conta de serviço
- Menu (☰) → **APIs e serviços** → **Credenciais**.
- **Criar credenciais** → **Conta de serviço**.
- Nome: `stark-export-bot` (qualquer nome) → **Criar e continuar**.
- Permissões/papel: pode pular (clicar **Continuar** → **Concluído**).

### 5. Gerar a chave JSON (este é o `credentials.json`)
- Na lista de **Contas de serviço**, clique na que você criou.
- Aba **Chaves** → **Adicionar chave** → **Criar nova chave**.
- Tipo: **JSON** → **Criar**.
- O arquivo baixa automaticamente. **Renomeie para `credentials.json`** e deixe na
  **Área de Trabalho (Desktop)** — é onde o `/stark-export:setup` procura por padrão.

### 6. Dar acesso ao Drive para a conta de serviço ⚠️ (passo que mais esquecem)
A conta de serviço tem um e-mail próprio (algo como
`stark-export-bot@stark-export.iam.gserviceaccount.com`). Ela **só enxerga pastas
compartilhadas com ela**.

- Copie esse e-mail (campo `client_email` do JSON, ou na tela da conta de serviço).
- No Google Drive, abra a pasta **Clientes** (pasta-raiz das artes).
- Botão direito → **Compartilhar** → cole o e-mail → permissão **Editor** → **Enviar**.

Sem esse passo o upload falha mesmo com o `credentials.json` correto.

### 7. Rodar o setup
No Claude Code, dentro do plugin:

```
/stark-export:setup
```

Ele copia o `credentials.json` do Desktop para `~/.stark-export/credentials.json`
e valida os campos.

---

## Quem não vai criar do zero

Pode pedir o `credentials.json` já pronto ao responsável pelo Drive da Stark e pular
para o passo 7 — **mas** o e-mail dessa conta de serviço ainda precisa ter acesso às
pastas dos clientes (passo 6).
