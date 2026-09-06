import path from "path";
import BaseEmbedding from "../models/base/embedding"
import crypto from "crypto"
import fs from 'fs';
import { splitText } from "../utils/splitText";
import { PDFParse } from 'pdf-parse';
import { CanvasFactory } from 'pdf-parse/worker';
import officeParser from 'officeparser'
import sharp from 'sharp'

const supportedMimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

type SupportedMimeType = typeof supportedMimeTypes[number];

type UploadManagerParams = {
    embeddingModel: BaseEmbedding<any>;
}

type RecordedFile = {
    id: string;
    name: string;
    filePath: string;
    contentPath: string;
    uploadedAt: string;
}

type FileRes = {
    fileName: string;
    fileExtension: string;
    fileId: string;
}

class UploadManager {
    private embeddingModel: BaseEmbedding<any>;
    static uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    static uploadedFilesRecordPath = path.join(this.uploadsDir, 'uploaded_files.json');

    constructor(private params: UploadManagerParams) {
        this.embeddingModel = params.embeddingModel;

        if (!fs.existsSync(UploadManager.uploadsDir)) {
            fs.mkdirSync(UploadManager.uploadsDir, { recursive: true });
        }

        if (!fs.existsSync(UploadManager.uploadedFilesRecordPath)) {
            const data = {
                files: [] as RecordedFile[]
            }
            fs.writeFileSync(UploadManager.uploadedFilesRecordPath, JSON.stringify(data, null, 2));
        }
    }

    private static getRecordedFiles(): RecordedFile[] {
        const data = fs.readFileSync(UploadManager.uploadedFilesRecordPath, 'utf-8');
        return JSON.parse(data).files;
    }

    private static addNewRecordedFile(fileRecord: RecordedFile) {
        const currentData = this.getRecordedFiles()

        currentData.push(fileRecord);

        fs.writeFileSync(UploadManager.uploadedFilesRecordPath, JSON.stringify({ files: currentData }, null, 2));
    }

    static getFile(fileId: string): RecordedFile | null {
        const recordedFiles = this.getRecordedFiles();

        return recordedFiles.find(f => f.id === fileId) || null;
    }

    static getFileChunks(fileId: string): { content: string; embedding: number[] }[] {
        try {
            const recordedFile = this.getFile(fileId);

            if (!recordedFile) {
                throw new Error(`File with ID ${fileId} not found`);
            }

            const contentData = JSON.parse(fs.readFileSync(recordedFile.contentPath, 'utf-8'))

            return contentData.chunks;
        } catch (err) {
            console.log('Error getting file chunks:', err);
            return [];
        }
    }

    /**
     * Read the OpenRouter API key from Vane's config.json (stored by the UI).
     * Falls back to env vars.
     */
    private static getOpenRouterKey(): string {
        try {
            const configPath = path.join(process.env.DATA_DIR || process.cwd(), '/data/config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const orProvider = (config.modelProviders || []).find(
                (p: any) => (p.config || {}).apiKey && ((p.config || {}).baseURL || '').includes('openrouter')
            );
            if (orProvider) return orProvider.config.apiKey || '';
        } catch {}
        return process.env.OPENROUTER_API_KEY || '';
    }

    private async extractContentAndEmbed(filePath: string, fileType: SupportedMimeType): Promise<string> {
        switch (fileType) {
            case 'text/plain':
                const content = fs.readFileSync(filePath, 'utf-8');

                const splittedText = splitText(content, 512, 128)
                const embeddings = await this.embeddingModel.embedText(splittedText)

                if (embeddings.length !== splittedText.length) {
                    throw new Error('Embeddings and text chunks length mismatch');
                }

                const contentPath = filePath.split('.').slice(0, -1).join('.') + '.content.json';

                const data = {
                    chunks: splittedText.map((text, i) => {
                        return {
                            content: text,
                            embedding: embeddings[i],
                        }
                    })
                }

                fs.writeFileSync(contentPath, JSON.stringify(data, null, 2));

                return contentPath;
            case 'application/pdf':
                const pdfBuffer = fs.readFileSync(filePath);

                const parser = new PDFParse({
                    data: pdfBuffer,
                    CanvasFactory
                })

                const pdfText = await parser.getText().then(res => res.text)

                const pdfSplittedText = splitText(pdfText, 512, 128)
                const pdfEmbeddings = await this.embeddingModel.embedText(pdfSplittedText)

                if (pdfEmbeddings.length !== pdfSplittedText.length) {
                    throw new Error('Embeddings and text chunks length mismatch');
                }

                const pdfContentPath = filePath.split('.').slice(0, -1).join('.') + '.content.json';

                const pdfData = {
                    chunks: pdfSplittedText.map((text, i) => {
                        return {
                            content: text,
                            embedding: pdfEmbeddings[i],
                        }
                    })
                }

                fs.writeFileSync(pdfContentPath, JSON.stringify(pdfData, null, 2));

                return pdfContentPath;
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                const docBuffer = fs.readFileSync(filePath);

                const docText = (await officeParser.parseOffice(docBuffer)).toText()

                const docSplittedText = splitText(docText, 512, 128)
                const docEmbeddings = await this.embeddingModel.embedText(docSplittedText)

                if (docEmbeddings.length !== docSplittedText.length) {
                    throw new Error('Embeddings and text chunks length mismatch');
                }

                const docContentPath = filePath.split('.').slice(0, -1).join('.') + '.content.json';

                const docData = {
                    chunks: docSplittedText.map((text, i) => {
                        return {
                            content: text,
                            embedding: docEmbeddings[i],
                        }
                    })
                }

                fs.writeFileSync(docContentPath, JSON.stringify(docData, null, 2));

                return docContentPath;
            case 'image/jpeg':
            case 'image/png':
            case 'image/gif':
            case 'image/webp': {
                // Vision OCR: extract text from image via OpenRouter vision model
                const imageBuffer = fs.readFileSync(filePath);
                const base64Image = imageBuffer.toString('base64');
                const imageMimeType = fileType;

                const openRouterKey = UploadManager.getOpenRouterKey();
                if (!openRouterKey) {
                    throw new Error('OpenRouter API key required for image processing. Add it in Settings > Model Providers.');
                }

                const visionModel = 'google/gemma-4-31b-it:free';

                const visionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + openRouterKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: visionModel,
                        messages: [{
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Extract ALL text from this image. Return only the text content, no descriptions or commentary. If there is no text, describe what the image shows in detail.' },
                                { type: 'image_url', image_url: { url: 'data:' + imageMimeType + ';base64,' + base64Image } }
                            ]
                        }],
                        max_tokens: 4096,
                    }),
                });

                if (!visionResponse.ok) {
                    const errorText = await visionResponse.text();
                    throw new Error('Vision API error: ' + errorText);
                }

                const visionResult = await visionResponse.json();
                const extractedText = visionResult.choices?.[0]?.message?.content || 'No text extracted from image';

                const imgSplittedText = splitText(extractedText, 512, 128)
                const imgEmbeddings = await this.embeddingModel.embedText(imgSplittedText)

                if (imgEmbeddings.length !== imgSplittedText.length) {
                    throw new Error('Embeddings and text chunks length mismatch');
                }

                const imgContentPath = filePath.split('.').slice(0, -1).join('.') + '.content.json';

                const imgData = {
                    chunks: imgSplittedText.map((text, i) => {
                        return {
                            content: text,
                            embedding: imgEmbeddings[i],
                        };
                    })
                }

                fs.writeFileSync(imgContentPath, JSON.stringify(imgData, null, 2));

                return imgContentPath;
            }

            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    }

    async processFiles(files: File[]): Promise<FileRes[]> {
        const processedFiles: FileRes[] = [];

        await Promise.all(files.map(async (file) => {
            if (!(supportedMimeTypes as unknown as string[]).includes(file.type)) {
                throw new Error(`File type ${file.type} not supported`);
            }

            const fileId = crypto.randomBytes(16).toString('hex');

            const fileExtension = file.name.split('.').pop();
            const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
            const filePath = path.join(UploadManager.uploadsDir, fileName);

            const buffer = Buffer.from(await file.arrayBuffer())

            fs.writeFileSync(filePath, buffer);

            const contentFilePath = await this.extractContentAndEmbed(filePath, file.type as SupportedMimeType);

            const fileRecord: RecordedFile = {
                id: fileId,
                name: file.name,
                filePath: filePath,
                contentPath: contentFilePath,
                uploadedAt: new Date().toISOString(),
            }

            UploadManager.addNewRecordedFile(fileRecord);

            processedFiles.push({
                fileExtension: fileExtension || '',
                fileId,
                fileName: file.name
            });
        }))

        return processedFiles;
    }
}

export default UploadManager;
