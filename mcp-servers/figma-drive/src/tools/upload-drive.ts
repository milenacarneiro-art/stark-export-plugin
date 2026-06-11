import { z } from 'zod';
import { uploadToDrive } from '../services/drive-api.js';

export const uploadDriveSchema = z.object({
  clientName: z.string().describe('Nome da pasta do cliente no Drive'),
  date: z.string().describe('Data do post (DD-MM, DD-MM-AA ou YYYY-MM-DD)'),
  files: z.array(z.string()).optional().describe('Caminhos locais dos arquivos para subir'),
  startFolderId: z.string().optional().describe('ID da pasta de ano (clientes com estrutura nao-padrao)'),
  folderSuffix: z.string().optional().describe('Sufixo opcional para a pasta de data'),
  dryRun: z.boolean().optional().default(false).describe('Se true, so navega sem subir arquivos'),
});

export type UploadDriveInput = z.infer<typeof uploadDriveSchema>;

export async function handleUploadDrive(input: UploadDriveInput) {
  const result = await uploadToDrive(input);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
