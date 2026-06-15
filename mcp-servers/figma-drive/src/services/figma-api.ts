import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  FIGMA_API_BASE,
  DEFAULT_OUTPUT,
  DEFAULT_SCALE,
  DEFAULT_BATCH_SIZE,
  getFigmaToken,
} from '../utils/constants.js';

export interface ExportedFile {
  name: string;
  path: string;
  nodeId: string;
  sizeKb: number;
}

export interface ExportResult {
  prefix: string;
  outputDir: string;
  totalRequested: number;
  totalDownloaded: number;
  files: ExportedFile[];
}

export interface FrameChild {
  nodeId: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameInfo {
  nodeId: string;
  name: string;
  type: string;
  width: number;
  height: number;
  children: FrameChild[];
}

interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string | null>;
}

/**
 * Lista os filhos diretos de um node (via REST API — não consome o Figma MCP).
 * Usado para detectar carrossel: cards são frames filhos do frame principal.
 */
export async function getFrameInfo(fileKey: string, nodeId: string): Promise<FrameInfo> {
  const token = getFigmaToken();
  const id = nodeId.replace('-', ':');

  const url = new URL(`${FIGMA_API_BASE}/files/${fileKey}/nodes`);
  url.searchParams.set('ids', id);
  url.searchParams.set('depth', '1');

  const resp = await fetch(url.toString(), { headers: { 'X-Figma-Token': token } });
  if (!resp.ok) {
    throw new Error(`Figma API /nodes retornou ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as any;
  const node = data.nodes?.[id]?.document;
  if (!node) {
    throw new Error(`Node ${id} nao encontrado no arquivo ${fileKey}.`);
  }

  const children: FrameChild[] = (node.children || [])
    .filter((c: any) => c.visible !== false)
    .map((c: any) => ({
      nodeId: c.id,
      name: c.name,
      type: c.type,
      x: c.absoluteBoundingBox?.x ?? 0,
      y: c.absoluteBoundingBox?.y ?? 0,
      width: c.absoluteBoundingBox?.width ?? 0,
      height: c.absoluteBoundingBox?.height ?? 0,
    }))
    .sort((a: FrameChild, b: FrameChild) => a.y - b.y || a.x - b.x);

  return {
    nodeId: node.id,
    name: node.name,
    type: node.type,
    width: node.absoluteBoundingBox?.width ?? 0,
    height: node.absoluteBoundingBox?.height ?? 0,
    children,
  };
}

export interface FrameText {
  nodeId: string;
  path: string;
  characters: string;
}

/**
 * Extrai todos os textos de um node e seus filhos (recursivo, via REST).
 * Equivalente ao use_figma com JS recursivo, sem consumir o Figma MCP.
 */
export async function collectFrameTexts(fileKey: string, nodeId: string): Promise<{ name: string; texts: FrameText[] }> {
  const token = getFigmaToken();
  const id = nodeId.replace('-', ':');

  const url = new URL(`${FIGMA_API_BASE}/files/${fileKey}/nodes`);
  url.searchParams.set('ids', id);

  const resp = await fetch(url.toString(), { headers: { 'X-Figma-Token': token } });
  if (!resp.ok) {
    throw new Error(`Figma API /nodes retornou ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as any;
  const root = data.nodes?.[id]?.document;
  if (!root) {
    throw new Error(`Node ${id} nao encontrado no arquivo ${fileKey}.`);
  }

  const texts: FrameText[] = [];
  const walk = (node: any, path: string) => {
    if (node.visible === false) return;
    if (node.type === 'TEXT' && node.characters?.trim()) {
      texts.push({ nodeId: node.id, path, characters: node.characters });
    }
    for (const child of node.children || []) {
      walk(child, `${path} > ${child.name}`);
    }
  };
  walk(root, root.name);

  return { name: root.name, texts };
}

/** Renderiza um node como PNG e retorna o buffer (para revisão visual). */
export async function renderNodePng(fileKey: string, nodeId: string, scale = 1): Promise<Buffer | null> {
  const token = getFigmaToken();
  const id = nodeId.replace('-', ':');
  const images = await exportNodesBatch(token, fileKey, [id], scale);
  const url = images?.[id];
  if (!url) return null;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  return Buffer.from(await resp.arrayBuffer());
}

async function exportNodesBatch(
  token: string,
  fileKey: string,
  nodeIds: string[],
  scale: number,
): Promise<Record<string, string | null> | null> {
  const url = new URL(`${FIGMA_API_BASE}/images/${fileKey}`);
  url.searchParams.set('ids', nodeIds.join(','));
  url.searchParams.set('format', 'png');
  url.searchParams.set('scale', String(scale));

  const resp = await fetch(url.toString(), {
    headers: { 'X-Figma-Token': token },
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    if (errorText.toLowerCase().includes('timeout') || resp.status === 400) {
      return null; // sinaliza retry com batch menor
    }
    throw new Error(`Figma API retornou ${resp.status}: ${errorText}`);
  }

  const data = (await resp.json()) as FigmaImagesResponse;
  if (data.err) {
    if (String(data.err).toLowerCase().includes('timeout')) return null;
    throw new Error(`Figma API erro: ${data.err}`);
  }

  return data.images;
}

async function exportNodes(
  token: string,
  fileKey: string,
  nodeIds: string[],
  scale: number,
  batchSize: number,
): Promise<Record<string, string | null>> {
  const allImages: Record<string, string | null> = {};

  if (nodeIds.length <= batchSize) {
    const images = await exportNodesBatch(token, fileKey, nodeIds, scale);
    if (images !== null) return images;

    for (const nodeId of nodeIds) {
      const single = await exportNodesBatch(token, fileKey, [nodeId], scale);
      if (single) Object.assign(allImages, single);
    }
    return allImages;
  }

  const numBatches = Math.ceil(nodeIds.length / batchSize);
  for (let i = 0; i < numBatches; i++) {
    const batch = nodeIds.slice(i * batchSize, (i + 1) * batchSize);
    const images = await exportNodesBatch(token, fileKey, batch, scale);
    if (images !== null) {
      Object.assign(allImages, images);
    } else {
      for (const nodeId of batch) {
        const single = await exportNodesBatch(token, fileKey, [nodeId], scale);
        if (single) Object.assign(allImages, single);
      }
    }
  }

  return allImages;
}

async function downloadImage(url: string, outputPath: string): Promise<number> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Erro ao baixar imagem: HTTP ${resp.status}`);
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  await writeFile(outputPath, buffer);
  return buffer.length;
}

export async function exportFigmaFrames(params: {
  fileKey: string;
  nodeIds: string[];
  prefix: string;
  scale?: number;
  outputDir?: string;
  batchSize?: number;
}): Promise<ExportResult> {
  const {
    fileKey,
    nodeIds,
    prefix,
    scale = DEFAULT_SCALE,
    outputDir = DEFAULT_OUTPUT,
    batchSize = DEFAULT_BATCH_SIZE,
  } = params;

  const token = getFigmaToken();
  const ids = nodeIds.map((n) => n.replace('-', ':'));

  await mkdir(outputDir, { recursive: true });

  const imageUrls = await exportNodes(token, fileKey, ids, scale, batchSize);

  const downloaded: ExportedFile[] = [];
  const total = ids.length;

  for (let i = 0; i < ids.length; i++) {
    const nodeId = ids[i];
    const url = imageUrls[nodeId];
    if (!url) continue;

    const filename = total === 1
      ? `${prefix}.png`
      : `${prefix}-card-${String(i + 1).padStart(2, '0')}.png`;

    const outputPath = join(outputDir, filename);
    const sizeBytes = await downloadImage(url, outputPath);

    downloaded.push({
      name: filename,
      path: outputPath,
      nodeId,
      sizeKb: Math.round((sizeBytes / 1024) * 10) / 10,
    });
  }

  return {
    prefix,
    outputDir,
    totalRequested: total,
    totalDownloaded: downloaded.length,
    files: downloaded,
  };
}
