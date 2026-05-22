import { DocumentService } from './document.service';
export declare class DocumentController {
    private readonly documentService;
    constructor(documentService: DocumentService);
    uploadFile(file: Express.Multer.File): Promise<{
        message: string;
        documentId: string;
        fileName: string;
        status: "PROCESSING" | "FAILED" | "PENDING" | "COMPLETED";
    }>;
    listDocuments(): Promise<import("./document.service").DocumentRecord[]>;
    getDocumentDetails(id: string): Promise<import("./document.service").DocumentRecord>;
    getDocumentAnalysis(id: string): Promise<{
        documentId: string;
        summary: string;
        entities: {
            name: string;
            type: string;
        }[];
        sentiment: string;
        visualizations: {
            chartType: "bar" | "line" | "pie";
            title: string;
            xAxis: string;
            yAxis: string;
            data: Array<Record<string, any>>;
        }[];
        status: "PROCESSING" | "FAILED" | "PENDING" | "COMPLETED";
    }>;
    queryCorpus(body: {
        query: string;
        documentIds?: string[];
    }): Promise<{
        answer: string;
        citations: any[];
    }>;
    deleteDocument(id: string): Promise<{
        message: string;
    }>;
}
