import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { getAccessToken } from './google-auth.js';
import {
  DRIVE_API_BASE,
  DRIVE_UPLOAD_BASE,
  MESES,
  monthFolderName,
  CONTENT_FOLDER_NAMES,
  normalizeDate,
} from '../utils/constants.js';

export interface UploadedFile {
  name: string;
  id: string;
  link: string;
  action: 'uploaded' | 'updated' | 'skipped';
}

export interface UploadResult {
  folderId: string;
  folderLink: string;
  created: boolean;
  files: UploadedFile[];
  steps: string[];
}

interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

async function driveGet(token: string, path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${DRIVE_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Drive API ${path} retornou ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}

async function findSharedDrive(token: string, name: string): Promise<{ id: string; name: string } | null> {
  const data = await driveGet(token, '/drives', { pageSize: '50' });
  const drives: Array<{ id: string; name: string }> = data.drives || [];
  const match = drives.find((d) => d.name?.trim().toLowerCase() === name.trim().toLowerCase());
  return match || null;
}

async function listFolders(
  token: string,
  q: string,
  pageSize: number,
  driveId?: string,
): Promise<DriveFolder[]> {
  const params: Record<string, string> = {
    q,
    fields: 'files(id, name, webViewLink)',
    pageSize: String(pageSize),
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  };
  if (driveId) {
    params.driveId = driveId;
    params.corpora = 'drive';
  }
  const data = await driveGet(token, '/files', params);
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    webViewLink: f.webViewLink || undefined,
  }));
}

function folderQuery(parentId: string): string {
  return `mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`;
}

async function findFolder(token: string, name: string, parentId: string, driveId?: string): Promise<DriveFolder | null> {
  const safeName = name.replace(/'/g, "\\'");
  const folders = await listFolders(token, `name = '${safeName}' and ${folderQuery(parentId)}`, 5, driveId);
  return folders[0] || null;
}

async function findFolderContains(token: string, searchText: string, parentId: string, driveId?: string): Promise<DriveFolder | null> {
  const safeText = searchText.replace(/'/g, "\\'");
  const folders = await listFolders(token, `name contains '${safeText}' and ${folderQuery(parentId)}`, 10, driveId);
  return folders[0] || null;
}

async function findContentFolder(token: string, parentId: string, driveId?: string): Promise<DriveFolder | null> {
  for (const name of CONTENT_FOLDER_NAMES) {
    const folder = await findFolder(token, name, parentId, driveId);
    if (folder) return folder;
  }
  for (const name of CONTENT_FOLDER_NAMES) {
    const folder = await findFolderContains(token, name, parentId, driveId);
    if (folder) return folder;
  }
  return null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<DriveFolder> {
  const url = `${DRIVE_API_BASE}/files?supportsAllDrives=true&fields=id,name,webViewLink`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  if (!resp.ok) {
    throw new Error(`Erro ao criar pasta '${name}' (${resp.status}): ${await resp.text()}`);
  }
  const data = await resp.json() as any;
  return { id: data.id, name: data.name, webViewLink: data.webViewLink || undefined };
}

/**
 * Busca a pasta do mês priorizando o padrão oficial "MM. MÊS" (ex: "06. JUNHO").
 * Evita cair em duplicatas fora do padrão (ex: "Junho").
 */
async function findOrCreateMonthFolder(
  token: string,
  mesNum: number,
  parentId: string,
  driveId: string | undefined,
  steps: string[],
): Promise<DriveFolder> {
  const padrao = monthFolderName(mesNum); // "06. JUNHO"
  const nome = MESES[mesNum];             // "Junho"

  let pasta = await findFolder(token, padrao, parentId, driveId);
  if (!pasta) {
    // contains casa "06. JUNHO", "junho", "Junho" — Drive é case-insensitive
    pasta = await findFolderContains(token, nome, parentId, driveId);
  }
  if (!pasta) {
    pasta = await createFolder(token, padrao, parentId);
    steps.push(`[mes] ${padrao} — criado -> ${pasta.id}`);
  } else {
    steps.push(`[mes] ${pasta.name} -> ${pasta.id}`);
  }
  return pasta;
}

async function findFileInFolder(
  token: string,
  name: string,
  parentId: string,
): Promise<{ id: string; size: number; webViewLink?: string } | null> {
  const safeName = name.replace(/'/g, "\\'");
  const data = await driveGet(token, '/files', {
    q: `name = '${safeName}' and '${parentId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'files(id, name, size, webViewLink)',
    pageSize: '2',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const f = (data.files || [])[0];
  return f ? { id: f.id, size: Number(f.size || 0), webViewLink: f.webViewLink } : null;
}

async function uploadFile(token: string, filePath: string, parentId: string): Promise<UploadedFile> {
  const fileName = basename(filePath);
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeType =
    ext === 'png' ? 'image/png' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'mp4' ? 'video/mp4' :
    ext === 'mov' ? 'video/quicktime' :
    'application/octet-stream';

  const size = statSync(filePath).size;

  // Idempotência: arquivo já no Drive com mesmo nome e tamanho → não sobe de novo;
  // mesmo nome e tamanho diferente → atualiza o conteúdo (sem criar duplicata)
  const existing = await findFileInFolder(token, fileName, parentId);
  if (existing && existing.size === size) {
    return {
      name: fileName,
      id: existing.id,
      link: existing.webViewLink || `https://drive.google.com/file/d/${existing.id}/view`,
      action: 'skipped',
    };
  }

  const initUrl = existing
    ? `${DRIVE_UPLOAD_BASE}/files/${existing.id}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink`;

  // Upload resumable em 2 passos — suporta arquivos grandes (vídeos de Reels)
  const initResp = await fetch(initUrl, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify(existing ? { name: fileName } : { name: fileName, parents: [parentId] }),
  });
  if (!initResp.ok) {
    throw new Error(`Erro ao iniciar upload de ${fileName} (${initResp.status}): ${await initResp.text()}`);
  }
  const location = initResp.headers.get('location');
  if (!location) throw new Error(`Upload de ${fileName}: sessao resumable sem Location.`);

  const body = await readFile(filePath);
  const upResp = await fetch(location, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType, 'Content-Length': String(size) },
    body,
  });
  if (!upResp.ok) {
    throw new Error(`Erro no upload de ${fileName} (${upResp.status}): ${await upResp.text()}`);
  }
  const data = await upResp.json() as any;
  return {
    name: data.name,
    id: data.id,
    link: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    action: existing ? 'updated' : 'uploaded',
  };
}

interface NavigationResult {
  folderId: string;
  folderLink: string;
  created: boolean;
  steps: string[];
}

async function navigateToDateFolder(
  token: string,
  clientName: string,
  dateStr: string,
  startFolderId?: string,
  folderSuffix?: string,
): Promise<NavigationResult> {
  const normalized = normalizeDate(dateStr);
  const parts = normalized.split('-');
  dateStr = normalized;

  const mesNum = parseInt(parts[1], 10);
  if (!MESES[mesNum]) throw new Error(`Mes invalido '${parts[1]}'.`);

  const steps: string[] = [];

  // Modo override: startFolderId aponta direto para a pasta de ano do cliente
  if (startFolderId) {
    steps.push(`[override] startFolderId -> ${startFolderId} (${clientName})`);

    const pastaMes = await findOrCreateMonthFolder(token, mesNum, startFolderId, undefined, steps);

    const dateFolderName = folderSuffix ? `${dateStr} ${folderSuffix}` : dateStr;
    let pastaData = await findFolder(token, dateFolderName, pastaMes.id);
    let created = false;
    if (!pastaData) {
      pastaData = await createFolder(token, dateFolderName, pastaMes.id);
      created = true;
      steps.push(`[data] ${dateFolderName} — criado -> ${pastaData.id}`);
    } else {
      steps.push(`[data] ${dateFolderName} -> ${pastaData.id}`);
    }

    const folderLink = pastaData.webViewLink || `https://drive.google.com/drive/folders/${pastaData.id}`;
    return { folderId: pastaData.id, folderLink, created, steps };
  }

  // Modo padrão: Clientes → cliente → conteúdo → Artes → ano → mês → data
  const ano = parts[0];
  let driveId: string | undefined;

  const sharedDrive = await findSharedDrive(token, 'Clientes');
  let clientesId: string;

  if (sharedDrive) {
    clientesId = sharedDrive.id;
    driveId = sharedDrive.id;
    steps.push(`[1/7] Clientes (Shared Drive) -> ${clientesId}`);
  } else {
    const folders = await listFolders(
      token,
      "name = 'Clientes' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      5,
    );
    if (folders.length === 0) {
      throw new Error("Pasta/Drive 'Clientes' nao encontrado. Verifique se foi compartilhado com o service account.");
    }
    clientesId = folders[0].id;
    steps.push(`[1/7] Clientes (pasta) -> ${clientesId}`);
  }

  let cliente = await findFolder(token, clientName, clientesId, driveId);
  if (!cliente) cliente = await findFolderContains(token, clientName, clientesId, driveId);
  if (!cliente) {
    throw new Error(`Pasta do cliente '${clientName}' nao encontrada dentro de 'Clientes'.`);
  }
  steps.push(`[2/7] ${cliente.name} -> ${cliente.id}`);

  const conteudo = await findContentFolder(token, cliente.id, driveId);
  if (!conteudo) {
    throw new Error(`Pasta de conteudo nao encontrada (${CONTENT_FOLDER_NAMES.join(' / ')}).`);
  }
  steps.push(`[3/7] ${conteudo.name} -> ${conteudo.id}`);

  let pastaAno = await findFolder(token, ano, conteudo.id, driveId);
  if (pastaAno) {
    steps.push(`[4/7] Artes — pulado (ano encontrado direto no Conteudo)`);
    steps.push(`[5/7] ${ano} -> ${pastaAno.id}`);
  } else {
    let artes = await findFolder(token, 'Artes', conteudo.id, driveId);
    if (!artes) artes = await findFolderContains(token, 'Artes', conteudo.id, driveId);
    if (!artes) {
      artes = await createFolder(token, 'Artes', conteudo.id);
      steps.push(`[4/7] Artes — criado -> ${artes.id}`);
    } else {
      steps.push(`[4/7] ${artes.name} -> ${artes.id}`);
    }

    pastaAno = await findFolder(token, ano, artes.id, driveId);
    if (!pastaAno) {
      pastaAno = await createFolder(token, ano, artes.id);
      steps.push(`[5/7] ${ano} — criado -> ${pastaAno.id}`);
    } else {
      steps.push(`[5/7] ${ano} -> ${pastaAno.id}`);
    }
  }

  const pastaMes = await findOrCreateMonthFolder(token, mesNum, pastaAno.id, driveId, steps);

  const dateFolderName = folderSuffix ? `${dateStr} ${folderSuffix}` : dateStr;
  let pastaData = await findFolder(token, dateFolderName, pastaMes.id, driveId);
  let created = false;
  if (!pastaData) {
    pastaData = await createFolder(token, dateFolderName, pastaMes.id);
    created = true;
    steps.push(`[7/7] ${dateFolderName} — criado -> ${pastaData.id}`);
  } else {
    steps.push(`[7/7] ${dateFolderName} -> ${pastaData.id}`);
  }

  const folderLink = pastaData.webViewLink || `https://drive.google.com/drive/folders/${pastaData.id}`;
  return { folderId: pastaData.id, folderLink, created, steps };
}

export async function uploadToDrive(params: {
  clientName: string;
  date: string;
  files?: string[];
  dryRun?: boolean;
  credentialsPath?: string;
  startFolderId?: string;
  folderSuffix?: string;
}): Promise<UploadResult> {
  const { clientName, date, files = [], dryRun = false, credentialsPath, startFolderId, folderSuffix } = params;

  const token = await getAccessToken(credentialsPath);
  const nav = await navigateToDateFolder(token, clientName, date, startFolderId, folderSuffix);

  if (dryRun) {
    return { folderId: nav.folderId, folderLink: nav.folderLink, created: nav.created, files: [], steps: nav.steps };
  }

  const validFiles = files.filter((f) => {
    try { statSync(f); return true; } catch { return false; }
  });

  if (validFiles.length === 0) {
    throw new Error('Nenhum arquivo valido encontrado para upload. Use dryRun para testar navegacao.');
  }

  const uploaded: UploadedFile[] = [];
  for (const filePath of validFiles) {
    uploaded.push(await uploadFile(token, filePath, nav.folderId));
  }

  return {
    folderId: nav.folderId,
    folderLink: nav.folderLink,
    created: nav.created,
    files: uploaded,
    steps: nav.steps,
  };
}
