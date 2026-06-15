#!/usr/bin/env node
// Guardrail de release do stark-export — roda no pre-push.
//
// Se commits indo pro remoto mexem em arquivos "shippable" (o que o time instala:
// skills/, mcp-servers/, hooks/, config/, .mcp.json, .claude-plugin/) mas a versao
// em .claude-plugin/plugin.json NAO mudou, bloqueia o push. Sem bump, o
// `claude plugin update` ignora os commits e o time nao recebe o fix.
//
// Bypass intencional (ex: doc urgente que voce sabe que nao precisa de release):
//   SKIP_VERSION_CHECK=1 git push

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (process.env.SKIP_VERSION_CHECK === '1') process.exit(0);

const ZERO = '0'.repeat(40);
const PLUGIN_JSON = '.claude-plugin/plugin.json';

// Arquivos que NAO exigem bump (so docs/tooling de dev — nao vao no que instala).
const DOC_ONLY = [
  /^README\.md$/,
  /^CLAUDE\.md$/,
  /^docs\//,
  /^scripts\//,
  /^\.githooks\//,
  /^LICENSE$/,
  /^\.gitignore$/,
];
const isShippable = (file) => file && !DOC_ONLY.some((re) => re.test(file));

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
}

function versionAt(sha) {
  try {
    return JSON.parse(git(`show ${sha}:${PLUGIN_JSON}`)).version ?? null;
  } catch {
    return null; // arquivo nao existe nesse commit
  }
}

// pre-push manda no stdin: "<localRef> <localSha> <remoteRef> <remoteSha>" por ref.
let input = '';
try {
  input = readFileSync(0, 'utf8');
} catch {
  /* sem stdin (chamada manual) — segue com fallback abaixo */
}

const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
let blocked = false;

for (const line of lines) {
  const [, localSha, , remoteSha] = line.split(/\s+/);
  if (!localSha || localSha === ZERO) continue; // deletando ref → ignora

  // Baseline: o que ja esta no remoto. Branch nova (remoteSha zerado) → compara com
  // origin/main se existir; senao nao da pra comparar, libera.
  let base = remoteSha && remoteSha !== ZERO ? remoteSha : null;
  if (!base) {
    try {
      base = git('rev-parse origin/main');
    } catch {
      continue;
    }
  }

  let changed;
  try {
    changed = git(`diff --name-only ${base} ${localSha}`).split('\n').filter(Boolean);
  } catch {
    continue; // base inacessivel (ex: shallow) — nao bloqueia
  }

  const shippable = changed.filter(isShippable);
  if (shippable.length === 0) continue; // so docs → ok sem bump

  const newV = versionAt(localSha);
  const oldV = versionAt(base);
  if (newV && newV !== oldV) continue; // versao mudou → ok

  blocked = true;
  console.error('\n\x1b[31m✗ Push bloqueado: mudanca shippable sem bump de versao.\x1b[0m');
  console.error(`  Versao em ${PLUGIN_JSON} continua "${oldV ?? '?'}" e estes arquivos do plugin mudaram:`);
  for (const f of shippable.slice(0, 12)) console.error(`    • ${f}`);
  if (shippable.length > 12) console.error(`    … e mais ${shippable.length - 12}`);
  console.error('\n  Sem bump, o `claude plugin update` ve "ja na ultima" e o time NAO recebe o fix.');
  console.error(`  → Suba a versao em ${PLUGIN_JSON} (e o rodape do README) e commite antes do push.`);
  console.error('  → Se for intencional e nao precisa de release: SKIP_VERSION_CHECK=1 git push\n');
}

process.exit(blocked ? 1 : 0);
