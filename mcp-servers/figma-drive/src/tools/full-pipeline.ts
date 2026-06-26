import { z } from 'zod';
import { exportFigmaFrames, getFrameInfo, type FrameChild, type FrameInfo } from '../services/figma-api.js';
import { uploadToDrive } from '../services/drive-api.js';
import { normalizeDate } from '../utils/constants.js';

export const fullPipelineSchema = z.object({
  figmaUrl: z.string().describe(
    'Link do frame no Figma (com node-id na URL). Ex: https://www.figma.com/design/ABC123/arquivo?node-id=1038-6'
  ),
  frameName: z.string().optional().describe(
    'Nome do frame no formato "[DATA] - [NOME]" (ex: "27-05 - Dr. João Exemplo"). ' +
    'Se omitido, o nome é lido automaticamente do Figma. Use apenas para sobrescrever ' +
    'um frame cujo nome no Figma nao segue o padrao.'
  ),
  mode: z.enum(['auto', 'single', 'carrossel']).optional().default('auto').describe(
    'single: exporta o frame inteiro como 1 PNG (estatico, capa reels). ' +
    'carrossel: exporta cada card filho como PNG separado. ' +
    'auto: detecta sozinho (2+ frames filhos = carrossel).'
  ),
  clientName: z.string().optional().describe(
    'Nome da pasta do cliente no Drive (drive_nome do config/clientes.yaml). ' +
    'Se omitido, usa o nome parseado do frameName.'
  ),
  startFolderId: z.string().optional().describe(
    'ID da pasta de ano no Drive para clientes com estrutura nao-padrao (drive_pasta_ano_id do config).'
  ),
  folderSuffix: z.string().optional().describe('Sufixo opcional para o nome da pasta de data no Drive.'),
  extraFiles: z.array(z.string()).optional().describe(
    'Caminhos locais de arquivos extras para subir junto (ex: .mp4 de Reels).'
  ),
  scale: z.number().optional().default(1).describe('Escala do export (default: 1 — tamanho 1x, regra fixa Stark)'),
  dryRun: z.boolean().optional().default(false).describe('Se true, so navega o Drive sem exportar nem subir.'),
});

export type FullPipelineInput = z.infer<typeof fullPipelineSchema>;

export function parseFigmaUrl(figmaUrl: string): { fileKey: string; nodeId: string } {
  const keyMatch = figmaUrl.match(/figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)/);
  if (!keyMatch) {
    throw new Error(`URL do Figma invalida: "${figmaUrl}". Esperado figma.com/design/[FILE_KEY]/...`);
  }
  const nodeMatch = figmaUrl.match(/node-id=([0-9]+[-:][0-9]+)/);
  if (!nodeMatch) {
    throw new Error(
      `URL sem node-id: "${figmaUrl}". Selecione o frame no Figma e copie o link (Ctrl/Cmd+L) ` +
      'para incluir o ?node-id= na URL.'
    );
  }
  return {
    fileKey: keyMatch[1],
    nodeId: nodeMatch[1].replace('-', ':'),
  };
}

function parseFrameName(frameName: string): { date: string; clientName: string } {
  const sepIndex = frameName.indexOf(' - ');
  if (sepIndex === -1) {
    throw new Error(
      `Nome do frame nao segue o padrao "[DATA] - [NOME]": "${frameName}". ` +
      'Renomeie o frame no Figma (ex: "27-05 - Dr. João") ou passe frameName manualmente.'
    );
  }
  const rawDate = frameName.substring(0, sepIndex).trim();
  const clientName = frameName.substring(sepIndex + 3).trim();
  return { date: normalizeDate(rawDate), clientName };
}

export const CONTAINER_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP', 'SECTION']);

/**
 * Decide se os filhos de um frame sao slides de carrossel — nao apenas
 * elementos internos de um card estatico (logo, texto, fundo).
 *
 * Contagem ("2+ filhos") sozinha gera falso positivo: card estatico tipico
 * tem varios grupos dentro e cada um seria exportado como "slide" recortado
 * e transparente. Slides reais de carrossel tem assinatura geometrica:
 *   1. dimensoes uniformes entre si (mesma largura E altura);
 *   2. cada slide preenche o frame-pai em um eixo — lado a lado (altura ≈
 *      altura do pai) ou empilhados (largura ≈ largura do pai). Elementos
 *      internos de um card sao menores que o pai nos dois eixos.
 *   3. slides ficam lado a lado SEM se sobrepor. Camadas full-bleed empilhadas
 *      de um card estatico (fundo + texto) tambem sao uniformes e cobrem o pai,
 *      mas se sobrepoem — e seriam picotadas. Por isso exigimos que a area do
 *      bounding-box que engloba os cards ≈ soma das areas (sem sobreposicao).
 */
export function detectCarrosselCards(parent: FrameInfo): FrameChild[] | null {
  const cards = parent.children.filter((c) => CONTAINER_TYPES.has(c.type));
  if (cards.length < 2) return null;

  const widths = cards.map((c) => c.width);
  const heights = cards.map((c) => c.height);
  const uniform = (vals: number[]) => {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return min > 0 && max <= min * 1.02; // ate 2% de variacao
  };
  if (!uniform(widths) || !uniform(heights)) return null;

  // cada card cobre o pai em pelo menos um eixo (≥95%)
  const spansParent = cards.every(
    (c) =>
      (parent.width > 0 && c.width >= parent.width * 0.95) ||
      (parent.height > 0 && c.height >= parent.height * 0.95)
  );
  if (!spansParent) return null;

  // slides nao se sobrepoem → bounding-box que os engloba ≈ soma das areas.
  // Empilhados (sobrepostos) → bbox << soma → rejeita (trata como card unico).
  const minX = Math.min(...cards.map((c) => c.x));
  const minY = Math.min(...cards.map((c) => c.y));
  const maxX = Math.max(...cards.map((c) => c.x + c.width));
  const maxY = Math.max(...cards.map((c) => c.y + c.height));
  const bboxArea = (maxX - minX) * (maxY - minY);
  const sumArea = cards.reduce((acc, c) => acc + c.width * c.height, 0);
  if (bboxArea < sumArea * 0.9) return null;

  return cards;
}

export async function handleFullPipeline(input: FullPipelineInput) {
  const { fileKey, nodeId } = parseFigmaUrl(input.figmaUrl);

  // Nome do frame: lido automaticamente do Figma quando nao informado.
  // A mesma consulta detecta carrossel (cards sao frames filhos do frame principal).
  let nodeIds = [nodeId];
  let modeUsed = 'single';
  let frameName = input.frameName;
  if (input.mode !== 'single' || !frameName) {
    const info = await getFrameInfo(fileKey, nodeId);
    if (!frameName) frameName = info.name;
    if (input.mode === 'carrossel') {
      // Forcado pelo usuario: exporta todos os filhos container, sem heuristica.
      const cards = info.children.filter((c) => CONTAINER_TYPES.has(c.type));
      if (cards.length === 0) {
        throw new Error(`Frame "${info.name}" nao tem cards filhos para exportar como carrossel.`);
      }
      nodeIds = cards.map((c) => c.nodeId);
      modeUsed = `carrossel (${cards.length} cards)`;
    } else if (input.mode === 'auto') {
      const cards = detectCarrosselCards(info);
      if (cards) {
        nodeIds = cards.map((c) => c.nodeId);
        modeUsed = `carrossel (${cards.length} cards)`;
      }
      // sem cards uniformes que preenchem o pai → card estatico (single)
    }
  }

  const { date, clientName: parsedName } = parseFrameName(frameName);
  const clientName = input.clientName || parsedName;
  const prefix = `${date}-${clientName}`;

  if (input.dryRun) {
    const upload = await uploadToDrive({
      clientName,
      date,
      dryRun: true,
      startFolderId: input.startFolderId,
      folderSuffix: input.folderSuffix,
    });
    return result({ frameName, date, clientName, mode: modeUsed, nodeIds, upload });
  }

  const exportResult = await exportFigmaFrames({
    fileKey,
    nodeIds,
    prefix,
    scale: input.scale,
  });

  if (exportResult.totalDownloaded === 0) {
    return result({ error: 'Nenhum frame exportado do Figma.', export: exportResult });
  }

  const filePaths = [
    ...exportResult.files.map((f) => f.path),
    ...(input.extraFiles || []),
  ];

  const uploadResult = await uploadToDrive({
    clientName,
    date,
    files: filePaths,
    startFolderId: input.startFolderId,
    folderSuffix: input.folderSuffix,
  });

  return result({
    frameName,
    date,
    clientName,
    mode: modeUsed,
    export: exportResult,
    upload: uploadResult,
  });
}

function result(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  };
}
