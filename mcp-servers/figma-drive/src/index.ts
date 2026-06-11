#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { exportFigmaSchema, handleExportFigma } from './tools/export-figma.js';
import { uploadDriveSchema, handleUploadDrive } from './tools/upload-drive.js';
import { fullPipelineSchema, handleFullPipeline } from './tools/full-pipeline.js';
import { inspectFrameSchema, handleInspectFrame } from './tools/inspect-frame.js';
import { reviewFrameSchema, handleReviewFrame } from './tools/review-frame.js';

const server = new McpServer({
  name: 'stark-figma-drive',
  version: '2.0.0',
});

server.tool(
  'figma_to_drive',
  'Pipeline completo em 1 chamada: recebe o link do frame no Figma, exporta como PNG ' +
  '(detecta carrossel automaticamente) e sobe na pasta certa do Drive do cliente. ' +
  'Use este tool como padrao para exportar agendas.',
  fullPipelineSchema.shape,
  async (input) => handleFullPipeline(input as any),
);

server.tool(
  'review_figma_frame',
  'Material de revisao de arte (Bia): extrai todos os textos do frame e retorna screenshot ' +
  'de cada card via REST do Figma. Use ANTES de figma_to_drive para revisar gramatica e nudez.',
  reviewFrameSchema.shape,
  async (input) => handleReviewFrame(input as any),
);

server.tool(
  'inspect_figma_frame',
  'Lista os filhos diretos de um frame do Figma (nome, tipo, posicao). ' +
  'Util para conferir cards de carrossel antes de exportar.',
  inspectFrameSchema.shape,
  async (input) => handleInspectFrame(input as any),
);

server.tool(
  'export_figma_frames',
  'Exporta frames do Figma como PNG (sem upload). Tool de baixo nivel — prefira figma_to_drive.',
  exportFigmaSchema.shape,
  async (input) => handleExportFigma(input as any),
);

server.tool(
  'upload_to_drive',
  'Sobe arquivos locais para a pasta do cliente no Drive (sem export). Tool de baixo nivel — prefira figma_to_drive.',
  uploadDriveSchema.shape,
  async (input) => handleUploadDrive(input as any),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Erro fatal no MCP server:', err);
  process.exit(1);
});
