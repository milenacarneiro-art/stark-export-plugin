import { z } from 'zod';
import { getFrameInfo, collectFrameTexts, renderNodePng } from '../services/figma-api.js';
import { parseFigmaUrl, CONTAINER_TYPES } from './full-pipeline.js';

export const reviewFrameSchema = z.object({
  figmaUrl: z.string().describe('Link do frame no Figma (com node-id na URL)'),
  mode: z.enum(['auto', 'single', 'carrossel']).optional().default('auto').describe(
    'single: revisa o frame inteiro. carrossel: revisa cada card filho. auto: detecta sozinho.'
  ),
  nodeIds: z.array(z.string()).optional().describe(
    'Revisar apenas estes nodes (ex: reverificacao pontual apos correcao). Ignora mode.'
  ),
  includeImages: z.boolean().optional().default(true).describe(
    'Se false, retorna so os textos (mais leve — util para reverificar gramatica apos correcao).'
  ),
  scale: z.number().optional().default(1).describe('Escala das imagens de revisao (default: 1)'),
});

export type ReviewFrameInput = z.infer<typeof reviewFrameSchema>;

/**
 * Material de revisão da Bia: textos extraídos + screenshot de cada frame/card.
 * A análise (gramática PT-BR + nudez) é feita pelo Claude com este retorno.
 */
export async function handleReviewFrame(input: ReviewFrameInput) {
  const { fileKey, nodeId } = parseFigmaUrl(input.figmaUrl);

  // Determinar quais nodes revisar
  let targets: Array<{ nodeId: string; label: string }>;
  let frameName: string | undefined;
  if (input.nodeIds?.length) {
    targets = input.nodeIds.map((n) => ({ nodeId: n.replace('-', ':'), label: n }));
  } else {
    const info = await getFrameInfo(fileKey, nodeId);
    frameName = info.name;
    const cards = info.children.filter((c) => CONTAINER_TYPES.has(c.type));
    const isCarrossel = input.mode === 'carrossel' || (input.mode === 'auto' && cards.length >= 2);
    targets = input.mode !== 'single' && isCarrossel && cards.length > 0
      ? cards.map((c, i) => ({ nodeId: c.nodeId, label: `card ${String(i + 1).padStart(2, '0')} — ${c.name}` }))
      : [{ nodeId: info.nodeId, label: info.name }];
  }

  const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [];
  const summary: any[] = [];
  const warnings: string[] = [];

  for (const target of targets) {
    let texts: any[] = [];
    try {
      const result = await collectFrameTexts(fileKey, target.nodeId);
      texts = result.texts;
    } catch (err: any) {
      warnings.push(`sem textos extraidos de ${target.label}: ${err.message}`);
    }
    summary.push({ nodeId: target.nodeId, frame: target.label, texts });
  }

  content.push({
    type: 'text',
    text: JSON.stringify({
      fileKey,
      frameName,
      frames_verificados: targets.length,
      textos: summary,
      avisos: warnings,
      nota: 'Analise os textos (gramatica PT-BR grave) e as imagens abaixo (nudez). ' +
        'As imagens seguem na mesma ordem dos frames listados.',
    }, null, 2),
  });

  if (input.includeImages) {
    for (const target of targets) {
      const png = await renderNodePng(fileKey, target.nodeId, input.scale);
      if (png) {
        content.push({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' });
      } else {
        content.push({ type: 'text', text: `⚠️ screenshot indisponivel para ${target.label} (${target.nodeId})` });
      }
    }
  }

  return { content };
}
