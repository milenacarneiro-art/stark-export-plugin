import { z } from 'zod';
import { exportFigmaFrames, getFrameInfo } from '../services/figma-api.js';
import { uploadToDrive } from '../services/drive-api.js';
import { normalizeDate } from '../utils/constants.js';

export const fullPipelineSchema = z.object({
  figmaUrl: z.string().describe(
    'Link do frame no Figma (com node-id na URL). Ex: https://www.figma.com/design/ABC123/arquivo?node-id=1038-6'
  ),
  frameName: z.string().describe(
    'Nome do frame no formato "[DATA] - [NOME]". Datas aceitas: DD-MM, DD-MM-AA ou YYYY-MM-DD. ' +
    'Ex: "27-05 - Dr. Rodolfo Soares".'
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
  scale: z.number().optional().default(2).describe('Escala do export (default: 2)'),
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
      'Exemplos: "27-05 - Dr. Rodolfo", "27-05-26 - Dr. Rodolfo", "2026-05-27 - Dr. Rodolfo".'
    );
  }
  const rawDate = frameName.substring(0, sepIndex).trim();
  const clientName = frameName.substring(sepIndex + 3).trim();
  return { date: normalizeDate(rawDate), clientName };
}

export const CONTAINER_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP', 'SECTION']);

export async function handleFullPipeline(input: FullPipelineInput) {
  const { fileKey, nodeId } = parseFigmaUrl(input.figmaUrl);
  const { date, clientName: parsedName } = parseFrameName(input.frameName);
  const clientName = input.clientName || parsedName;
  const prefix = `${date}-${clientName}`;

  // Detectar carrossel: cards sao frames filhos do frame principal
  let nodeIds = [nodeId];
  let modeUsed = 'single';
  if (input.mode !== 'single') {
    const info = await getFrameInfo(fileKey, nodeId);
    const cards = info.children.filter((c) => CONTAINER_TYPES.has(c.type));
    const isCarrossel = input.mode === 'carrossel' || (input.mode === 'auto' && cards.length >= 2);
    if (isCarrossel) {
      if (cards.length === 0) {
        throw new Error(`Frame "${info.name}" nao tem cards filhos para exportar como carrossel.`);
      }
      nodeIds = cards.map((c) => c.nodeId);
      modeUsed = `carrossel (${cards.length} cards)`;
    }
  }

  if (input.dryRun) {
    const upload = await uploadToDrive({
      clientName,
      date,
      dryRun: true,
      startFolderId: input.startFolderId,
      folderSuffix: input.folderSuffix,
    });
    return result({ frameName: input.frameName, date, clientName, mode: modeUsed, nodeIds, upload });
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
    frameName: input.frameName,
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
