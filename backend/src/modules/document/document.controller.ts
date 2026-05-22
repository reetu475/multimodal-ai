import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from './document.service';

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const document = await this.documentService.registerDocument(file);
    return {
      message: 'File successfully uploaded and queued for processing.',
      documentId: document.id,
      fileName: document.fileName,
      status: document.status,
    };
  }

  @Get()
  async listDocuments() {
    return this.documentService.getAllDocuments();
  }

  @Get(':id')
  async getDocumentDetails(@Param('id') id: string) {
    return this.documentService.getDocument(id);
  }

  @Get(':id/analysis')
  async getDocumentAnalysis(@Param('id') id: string) {
    const doc = await this.documentService.getDocument(id);
    return {
      documentId: doc.id,
      summary: doc.summary || 'Analysis pending...',
      entities: doc.entities || [],
      sentiment: doc.sentiment || 'NEUTRAL',
      visualizations: doc.visualizations || [],
      status: doc.status,
      errorMessage: doc.errorMessage,
    };
  }

  @Post('query')
  @HttpCode(HttpStatus.OK)
  async queryCorpus(@Body() body: { query: string; documentIds?: string[] }) {
    return this.documentService.queryDocuments(body.query, body.documentIds);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string) {
    await this.documentService.deleteDocument(id);
    return {
      message: `Document ${id} successfully deleted.`,
    };
  }
}
