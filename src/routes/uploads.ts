import express from 'express';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Embeddings } from '@langchain/core/embeddings';
import { getAvailableEmbeddingModelProviders } from '../lib/providers';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import { RAGDocumentChain } from '../chains/rag_document_upload';
import { Chroma } from "@langchain/community/vectorstores/chroma";

const router = express.Router();

// Ajout d'un cache pour les embeddings avec le bon type
const embeddingsCache = new Map<string, number[]>();

// Configuration optimisée du text splitter
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500,
  chunkOverlap: 150,
  separators: ["\n\n", "\n", ".", "!", "?", ";", ":", " ", ""],
  keepSeparator: false,
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

// Optimisation du traitement des documents
const processDocumentInBatches = async (
  docs: Document[],
  batchSize: number = 50
): Promise<Document[]> => {
  const processedDocs: Document[] = [];
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const processed = await Promise.all(
      batch.map(async (doc) => preprocessDocument(doc))
    );
    processedDocs.push(...processed);
  }
  
  return processedDocs;
};

// Optimisation de l'extraction du texte avec des loaders natifs
const extractDocument = async (filePath: string, mimeType: string): Promise<Document[]> => {
  try {
    console.log(`📄 Extraction du document: ${filePath} (${mimeType})`);
    
    let docs: Document[] = [];
    
    if (mimeType === 'application/pdf') {
      const loader = new PDFLoader(filePath, {
        splitPages: true,
        parsedItemSeparator: "\n",
      });
      docs = await loader.load();
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const loader = new DocxLoader(filePath);
      docs = await loader.load();
    } else if (mimeType === 'text/plain') {
      // Traitement direct des fichiers texte
      const text = fs.readFileSync(filePath, 'utf-8');
      docs = [new Document({
        pageContent: text,
        metadata: {
          source: filePath,
          type: 'text',
          mime_type: mimeType
        }
      })];
    } else {
      throw new Error(`Type de fichier non supporté: ${mimeType}`);
    }
    
    console.log(`📑 ${docs.length} pages extraites`);
    
    // Amélioration du traitement des documents
    const enhancedDocs = docs.map((doc, index) => {
      return new Document({
        pageContent: doc.pageContent,
        metadata: {
          ...doc.metadata,
          source: filePath,
          page: index + 1,
          total_pages: docs.length,
          mime_type: mimeType,
          extraction_date: new Date().toISOString()
        }
      });
    });
    
    return enhancedDocs;
  } catch (error) {
    console.error(`❌ Erreur lors de l'extraction: ${error.message}`);
    throw error;
  }
};

// Fonction utilitaire pour normaliser les embeddings
const normalizeL2 = (vector: number[]): number[] => {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? vector : vector.map(v => v / norm);
};

// Optimisation de la génération des embeddings
const generateEmbeddings = async (
  texts: string[],
  embeddingsModel: Embeddings,
  dimensions: number = 1536
): Promise<number[][]> => {
  try {
    // Nettoyage et préparation des textes
    const cleanedTexts = texts.map(text => 
      text.replace(/\s+/g, ' ')
         .trim()
         .slice(0, 8000)  // Limite OpenAI
    ).filter(text => text.length > 0);

    if (cleanedTexts.length === 0) {
      throw new Error("Aucun texte valide à traiter");
    }

    // Traitement par lots de 100 (limite OpenAI)
    const batchSize = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < cleanedTexts.length; i += batchSize) {
      const batch = cleanedTexts.slice(i, i + batchSize);
      console.log(`🔄 Traitement du lot ${Math.floor(i / batchSize) + 1}/${Math.ceil(cleanedTexts.length / batchSize)}`);

      const batchEmbeddings = await embeddingsModel.embedDocuments(batch);
      
      // Redimensionnement et normalisation si nécessaire
      const processedEmbeddings = batchEmbeddings.map(emb => {
        const resized = (emb as number[]).slice(0, dimensions);
        return normalizeL2(resized);
      });
      
      embeddings.push(...processedEmbeddings);
    }

    return embeddings;
  } catch (error) {
    console.error("❌ Erreur lors de la génération des embeddings:", error);
    throw error;
  }
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
      const provider = embedding_model_provider ?? Object.keys(embeddingModels)[0];
      const embeddingModel = embedding_model ?? Object.keys(embeddingModels[provider])[0];
      
      let embeddingsModel: Embeddings | undefined;
      if (embeddingModels[provider] && embeddingModels[provider][embeddingModel]) {
        embeddingsModel = embeddingModels[provider][embeddingModel].model as Embeddings;
      }

      if (!embeddingsModel) {
        console.error("❌ [Uploads] Modèle invalide");
        res.status(400).json({ message: 'Invalid LLM model selected' });
        return;
      }

      const files = req.files['files'] as Express.Multer.File[];
      if (!files?.length) {
        console.warn("⚠️ [Uploads] Aucun fichier reçu");
        res.status(400).json({ message: 'No files uploaded' });
        return;
      }

      // Traitement parallèle des fichiers
      const results = await Promise.all(
        files.map(async (file) => {
          try {
            console.log(`📄 [Uploads] Traitement du fichier: ${file.originalname}`);
            
            let docs: Document[] = [];
            const cacheKey = `${file.path}_${embedding_model}`;
            
            if (embeddingsCache.has(cacheKey)) {
              console.log("🎯 [Uploads] Utilisation du cache pour", file.originalname);
              return {
                fileName: file.originalname,
                fileId: file.filename.replace(/\.\w+$/, ''),
                cached: true
              };
            }

            docs = await extractDocument(file.path, file.mimetype);
            const processedDocs = await processDocumentInBatches(docs);
            console.log(`✂️ [Uploads] ${processedDocs.length} documents traités`);

            // Utilisation de la nouvelle fonction d'embeddings
            const embeddings = await generateEmbeddings(
              processedDocs.map(doc => doc.pageContent),
              embeddingsModel,
              1536  // Dimension par défaut pour text-embedding-3-small
            );

            // Mise en cache du premier embedding
            if (embeddings.length > 0) {
              embeddingsCache.set(cacheKey, embeddings[0]);
            }

            // Sauvegarde avec les embeddings normalisés
            const pathToSave = file.path.replace(/\.\w+$/, '-extracted.json');
            fs.writeFileSync(pathToSave, JSON.stringify({
              title: file.originalname,
              contents: processedDocs.map((doc, index) => ({
                content: doc.pageContent,
                metadata: doc.metadata,
                embedding: embeddings[index]
              })),
              pageCount: docs.length,
              processingDate: new Date().toISOString()
            }, null, 2));

            return {
              fileName: file.originalname,
              fileId: file.filename.replace(/\.\w+$/, ''),
              stats: {
                chunks: processedDocs.length,
                pages: docs.length,
                embeddingsGenerated: embeddings.length
              }
            };
          } catch (error) {
            console.error(`❌ Erreur lors du traitement de ${file.originalname}:`, error);
            return {
              fileName: file.originalname,
              fileId: file.filename.replace(/\.\w+$/, ''),
              error: error.message
            };
          }
        })
      );

      res.status(200).json({ files: results });
      
    } catch (err: any) {
      console.error("❌ [Uploads] Erreur:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json({ message: 'An error has occurred.' });
    }
  }
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

router.get('/:fileId/content', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Chercher le fichier PDF dans le dossier uploads
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const files = fs.readdirSync(uploadsDir);
    const pdfFile = files.find(file => file.startsWith(fileId) && file.endsWith('.pdf'));
    
    if (!pdfFile) {
      console.error(`❌ PDF non trouvé pour l'ID: ${fileId}`);
      return res.status(404).json({ error: 'Document PDF non trouvé' });
    }

    const filePath = path.join(uploadsDir, pdfFile);
    console.log("📄 Envoi du fichier PDF:", filePath);

    // Headers pour le PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFile}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache d'une heure
    
    // Envoyer le fichier
    res.sendFile(filePath);
  } catch (error) {
    console.error('❌ Erreur lors de l\'accès au PDF:', error);
    res.status(500).json({ error: 'Erreur lors de l\'accès au document' });
  }
});

// Route pour les métadonnées du document
router.get('/:fileId/metadata', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Chercher le fichier JSON des métadonnées
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const metadataPath = path.join(uploadsDir, `${fileId}-extracted.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Métadonnées non trouvées' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    res.json(metadata);
  } catch (error) {
    console.error('❌ Erreur lors de la lecture des métadonnées:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture des métadonnées' });
  }
});

export default router;
