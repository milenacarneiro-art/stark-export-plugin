import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { DRIVE_SCOPE, getCredentialsPath } from '../utils/constants.js';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Autentica com Service Account do Google via JWT (RS256) — sem dependências.
 * Token é cacheado até 1 min antes de expirar.
 */
export async function getAccessToken(credentialsPath?: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const keyFile = getCredentialsPath(credentialsPath);
  const sa = JSON.parse(readFileSync(keyFile, 'utf8')) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) {
    throw new Error(`credentials.json invalido (${keyFile}): faltam client_email/private_key.`);
  }

  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: DRIVE_SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key).toString('base64url');
  const jwt = `${header}.${claims}.${signature}`;

  const resp = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Falha na autenticacao Google (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}
