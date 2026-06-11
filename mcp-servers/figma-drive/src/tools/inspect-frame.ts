import { z } from 'zod';
import { getFrameInfo } from '../services/figma-api.js';
import { parseFigmaUrl } from './full-pipeline.js';

export const inspectFrameSchema = z.object({
  figmaUrl: z.string().describe('Link do frame no Figma (com node-id na URL)'),
});

export type InspectFrameInput = z.infer<typeof inspectFrameSchema>;

export async function handleInspectFrame(input: InspectFrameInput) {
  const { fileKey, nodeId } = parseFigmaUrl(input.figmaUrl);
  const info = await getFrameInfo(fileKey, nodeId);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ fileKey, ...info }, null, 2) }],
  };
}
