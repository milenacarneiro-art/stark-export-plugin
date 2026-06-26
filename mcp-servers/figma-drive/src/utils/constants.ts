import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export const FIGMA_API_BASE = 'https://api.figma.com/v1';
export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const DEFAULT_OUTPUT = join(tmpdir(), 'figma_exports');
export const DEFAULT_SCALE = 1;
export const DEFAULT_BATCH_SIZE = 5;

/** Pasta de config do designer: ~/.stark-export/ */
export const CONFIG_DIR = join(homedir(), '.stark-export');

/** Valor de env não resolvido pelo Claude Code chega como "${VAR}" — tratar como vazio. */
function cleanEnv(value: string | undefined): string | undefined {
  if (!value || value.startsWith('${')) return undefined;
  return value;
}

export function getFigmaToken(): string {
  const fromEnv = cleanEnv(process.env.FIGMA_TOKEN);
  if (fromEnv) return fromEnv;

  const configPath = join(CONFIG_DIR, 'config.json');
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
      if (cfg.figma_token) return cfg.figma_token;
    } catch { /* cai no erro abaixo */ }
  }

  throw new Error(
    'FIGMA_TOKEN nao encontrado. Rode /stark-export:setup para configurar ' +
    `(grava em ${configPath}). Gere o token em: Figma > Settings > Security > Personal access tokens.`
  );
}

export function getCredentialsPath(override?: string): string {
  const candidate = override || cleanEnv(process.env.GOOGLE_CREDENTIALS_PATH)
    || join(CONFIG_DIR, 'credentials.json');

  if (existsSync(candidate)) return candidate;

  // Auto-corrige dupla extensão: credentials.json.json → credentials.json
  if (candidate.endsWith('.json.json')) {
    const fixed = candidate.slice(0, -5);
    if (existsSync(fixed)) return fixed;
  }

  throw new Error(
    `Arquivo de credenciais Google nao encontrado: ${candidate}. ` +
    'Rode /stark-export:setup para copiar o credentials.json para o lugar certo.'
  );
}

/**
 * Normaliza formatos de data do nome do frame para YYYY-MM-DD.
 *   DD-MM       ex: "27-05"      → "2026-05-27"  (ano corrente)
 *   DD-MM-AA    ex: "27-05-26"   → "2026-05-27"
 *   YYYY-MM-DD  ex: "2026-05-27" → "2026-05-27"
 */
export function normalizeDate(input: string): string {
  const trimmed = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  if (/^\d{2}-\d{2}-\d{2}$/.test(trimmed)) {
    const [day, month, yy] = trimmed.split('-');
    return `20${yy}-${month}-${day}`;
  }

  if (/^\d{2}-\d{2}$/.test(trimmed)) {
    const [day, month] = trimmed.split('-');
    const year = new Date().getFullYear();
    return `${year}-${month}-${day}`;
  }

  throw new Error(
    `Formato de data nao reconhecido: "${input}". ` +
    'Use DD-MM, DD-MM-AA ou YYYY-MM-DD. Ex: "27-05", "27-05-26", "2026-05-27".'
  );
}

export const MESES: Record<number, string> = {
  1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
  5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
  9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
};

/** Padrão oficial das pastas de mês no Drive: "06. JUNHO" */
export function monthFolderName(mesNum: number): string {
  const nome = MESES[mesNum];
  if (!nome) throw new Error(`Mes invalido '${mesNum}'.`);
  return `${String(mesNum).padStart(2, '0')}. ${nome.toUpperCase()}`;
}

export const CONTENT_FOLDER_NAMES = [
  'Cronograma de Conteúdo',
  'C. Conteúdo',
  'Cronograma de Conteudo',
  'C. Conteudo',
];

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
