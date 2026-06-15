#!/usr/bin/env node
// SessionStart hook do stark-export — padroniza o onboarding.
//
// Toda sessao verifica se ~/.stark-export/ esta configurado. Se faltar algo,
// injeta um aviso identico para todo mundo pedindo /stark-export:setup.
// NAO bloqueia nada — so orienta. Cross-platform (Windows/Mac/Linux): roda via node.

const fs = require('node:fs');
const path = require('node:path');

const home = process.env.USERPROFILE || process.env.HOME || '';
const dir = path.join(home, '.stark-export');
const configFile = path.join(dir, 'config.json');      // token do Figma
const credsFile = path.join(dir, 'credentials.json');  // service account do Google

const missing = [];
if (!hasFigmaToken(configFile)) missing.push('token do Figma (config.json)');
if (!hasGoogleCreds(credsFile)) missing.push('credenciais do Google (credentials.json)');

// Tudo certo → sai silencioso, sessao segue normal.
if (missing.length === 0) process.exit(0);

const aviso =
  'stark-export ainda nao configurado neste computador — falta: ' +
  missing.join(' e ') +
  '. Rode /stark-export:setup uma vez antes de exportar (so na primeira vez).';

const out = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext:
      'O plugin stark-export NAO esta configurado (' +
      missing.join(', ') +
      '). Se o usuario pedir para exportar do Figma, rode o onboarding inline ' +
      'conforme skills/setup/SKILL.md (ou oriente /stark-export:setup) ANTES de ' +
      'chamar qualquer tool do MCP figma-drive.',
  },
  // systemMessage aparece para o usuario — o aviso padronizado.
  systemMessage: '⚠️ ' + aviso,
};

process.stdout.write(JSON.stringify(out));
process.exit(0);

// config.json valido = JSON com figma_token nao-vazio (mesma checagem do setup).
function hasFigmaToken(p) {
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return typeof j.figma_token === 'string' && j.figma_token.trim().length > 0;
  } catch {
    return false;
  }
}

// credentials.json valido = service account com client_email e private_key.
function hasGoogleCreds(p) {
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Boolean(j.client_email) && Boolean(j.private_key);
  } catch {
    return false;
  }
}
