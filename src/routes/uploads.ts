import express from 'express';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Embeddings } from '@langchain/core/embeddings';
import { getAvailableEmbeddingModelProviders } from '../lib/providers';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { RAGDocumentChain } from '../chains/rag_document_upload';
import { Chroma } from "langchain/vectorstores/chroma";

const router = express.Router();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ".", "!", "?", ";", ":", " ", ""],
  keepSeparator: true,
  lengthFunction: (text) => text.length
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), './uploads'));
  },
  filename: (req, file, cb) => {
    const splitedFileName = file.originalname.split('.');
    const fileExtension = splitedFileName[splitedFileName.length - 1];
    if (!['pdf', 'docx', 'txt'].includes(fileExtension)) {
      return cb(new Error('File type is not supported'), '');
    }
    cb(null, `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`);
  },
});

const upload = multer({ storage });

const preprocessDocument = (doc: Document): Document => {
  const cleanContent = doc.pageContent
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();

  return new Document({
    pageContent: cleanContent,
    metadata: {
      ...doc.metadata,
      chunk_type: 'text',
      word_count: cleanContent.split(/\s+/).length,
      processed_date: new Date().toISOString()
    }
  });
};

const scoreDocument = (doc: Document): number => {
  const wordCount = doc.pageContent.split(/\s+/).length;
  const sentenceCount = doc.pageContent.split(/[.!?]+/).length;
  return wordCount > 10 && sentenceCount > 0 ? 1 : 0;
};

router.post(
  '/',
  upload.fields([
    { name: 'files' },
    { name: 'embedding_model', maxCount: 1 },
    { name: 'embedding_model_provider', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("📥 [Uploads] Début du traitement avec body:", {
        embedding_model: req.body.embedding_model,
        embedding_model_provider: req.body.embedding_model_provider
      });

      const { embedding_model, embedding_model_provider } = req.body;

      if (!embedding_model || !embedding_model_provider) {
        console.warn("⚠️ [Uploads] Modèle ou provider manquant");
        res.status(400).json({ message: 'Missing embedding model or provider' });
        return;
      }

      const embeddingModels = await getAvailableEmbeddingModelProviders();
      console.log("🔍 [Uploads] Modèles disponibles:", Object.keys(embeddingModels));

      const provider = embedding_model_provider ?? Object.keys(embeddingModels)[0];
      const embeddingModel: Embeddings = embedding_model ?? Object.keys(embeddingModels[provider])[0];

      console.log("🤖 [Uploads] Modèle sélectionné:", { provider, model: embeddingModel });

      let embeddingsModel: Embeddings | undefined;
      if (embeddingModels[provider] && embeddingModels[provider][embeddingModel]) {
        embeddingsModel = embeddingModels[provider][embeddingModel].model as Embeddings | undefined;
      }

      if (!embeddingsModel) {
        console.error("❌ [Uploads] Modèle invalide");
        res.status(400).json({ message: 'Invalid LLM model selected' });
        return;
      }

      const files = req.files['files'] as Express.Multer.File[];
      console.log("📁 [Uploads] Fichiers reçus:", files?.map(f => ({
        name: f.originalname,
        path: f.path,
        type: f.mimetype
      })));

      if (!files || files.length === 0) {
        console.warn("⚠️ [Uploads] Aucun fichier reçu");
        res.status(400).json({ message: 'No files uploaded' });
        return;
      }

      const processedDocs: Document[] = [];
      const ragChain = new RAGDocumentChain();
      let totalPages = 0;

      await Promise.all(
        files.map(async (file) => {
          console.log(`📄 [Uploads] Traitement du fichier: ${file.originalname}`);
          let docs: Document[] = [];

          if (file.mimetype === 'application/pdf') {
            console.log(`📚 [Uploads] Chargement du PDF: ${file.path}`);
            const loader = new PDFLoader(file.path, {
              splitPages: true
            });
            docs = await loader.load();
            totalPages += docs.length;
          } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            console.log(`📝 [Uploads] Chargement du DOCX: ${file.path}`);
            const loader = new DocxLoader(file.path);
            docs = await loader.load();
            totalPages += docs.length;
          } else if (file.mimetype === 'text/plain') {
            console.log(`📄 [Uploads] Chargement du TXT: ${file.path}`);
            const text = fs.readFileSync(file.path, 'utf-8');
            docs = [new Document({ 
              pageContent: text, 
              metadata: { 
                title: file.originalname,
                source: file.path,
                type: 'text'
              } 
            })];
            totalPages += 1;
          }

          const preprocessedDocs = docs.map(preprocessDocument);
          const scoredDocs = preprocessedDocs.filter(doc => scoreDocument(doc) > 0);
          
          console.log(`✂️ [Uploads] Splitting du document en ${scoredDocs.length} parties valides`);
          const splitted = await splitter.splitDocuments(scoredDocs);

          const enrichedDocs = splitted.map((doc, index) => {
            const pageNumber = Math.floor(index / (splitted.length / docs.length)) + 1;
            return new Document({
              pageContent: doc.pageContent,
              metadata: {
                ...doc.metadata,
                source: file.path,
                title: file.originalname,
                page_number: pageNumber,
                chunk_index: index,
                total_chunks: splitted.length,
                file_type: file.mimetype,
                search_text: doc.pageContent.substring(0, 100).trim()
              }
            });
          });

          processedDocs.push(...enrichedDocs);

          const pathToSave = file.path.replace(/\.\w+$/, '-extracted.json');
          const contentToSave = {
            title: file.originalname,
            contents: enrichedDocs.map((doc) => ({
              content: doc.pageContent,
              metadata: doc.metadata
            })),
            pageCount: docs.length,
            processingDate: new Date().toISOString()
          };

          fs.writeFileSync(pathToSave, JSON.stringify(contentToSave, null, 2));

          console.log(`🧮 [Uploads] Génération des embeddings pour ${enrichedDocs.length} chunks`);
          const embeddings = await embeddingsModel.embedDocuments(
            enrichedDocs.map((doc) => doc.pageContent)
          );

          const pathToSaveEmbeddings = file.path.replace(/\.\w+$/, '-embeddings.json');
          const embeddingsToSave = {
            title: file.originalname,
            embeddings: embeddings.map((embedding, index) => ({
              vector: embedding,
              metadata: enrichedDocs[index].metadata
            }))
          };

          fs.writeFileSync(pathToSaveEmbeddings, JSON.stringify(embeddingsToSave));
        })
      );

      console.log("🔄 [Uploads] Initialisation du vectorStore avec", processedDocs.length, "documents");
      const initResult = await ragChain.initializeVectorStoreFromDocuments(
        processedDocs,
        embeddingsModel
      );
      
      console.log("✅ [Uploads] VectorStore initialisé:", initResult);

      res.status(200).json({
        files: files.map((file) => ({
          fileName: file.originalname,
          fileExtension: file.filename.split('.').pop(),
          fileId: file.filename.replace(/\.\w+$/, ''),
          stats: {
            chunks: processedDocs.filter(d => d.metadata.source === file.path).length,
            pages: totalPages
          }
        })),
      });
    } catch (err: any) {
      console.error("❌ [Uploads] Erreur:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      logger.error(`Error in uploading file results: ${err.message}`);
      res.status(500).json({ message: 'An error has occurred.' });
    }
  },
);

router.get('/:fileId/view', async (req, res) => {
  try {
    const { fileId } = req.params;
    const search = req.query.search as string;
    const page = req.query.page as string;
    
    // Chercher tous les fichiers qui commencent par fileId dans le dossier uploads
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const files = fs.readdirSync(uploadsDir);
    const pdfFile = files.find(file => file.startsWith(fileId) && file.endsWith('.pdf'));
    
    if (!pdfFile) {
      console.error(`❌ PDF non trouvé pour l'ID: ${fileId}`);
      return res.status(404).json({ error: 'Document PDF non trouvé' });
    }

    const filePath = path.join(uploadsDir, pdfFile);
    console.log("📄 Envoi du fichier:", filePath);

    // Définir les headers pour le PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFile}"`);
    
    // Ajouter les paramètres de navigation et de surlignage
    if (search) {
      // Nettoyer le texte de recherche
      const cleanSearch = search
        .replace(/[\n\r]+/g, ' ')
        .trim();

      if (cleanSearch) {
        res.setHeader('X-PDF-Search', cleanSearch);
        res.setHeader('X-PDF-Highlight', 'true');
        res.setHeader('X-PDF-Highlight-Color', '#FFD700'); // Or
      }
    }
    
    if (page) {
      res.setHeader('X-PDF-Page', page);
    }

    // Envoyer le fichier
    res.sendFile(filePath);
  } catch (error) {
    console.error('❌ Erreur lors de la visualisation du document:', error);
    res.status(500).json({ error: 'Erreur lors de la visualisation du document' });
  }
});

export default router;
