import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableSequence, RunnableMap } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';

// Type local pour la chaîne de recherche
type SearchInput = {
  query: string;
  chat_history: BaseMessage[];
  type?: string;
};

export class RAGDocumentChain {
  private vectorStore: Chroma | null = null;
  private textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ".", "!", "?", ";", ":", " ", ""],
    keepSeparator: true,
    lengthFunction: (text) => text.length
  });

  // Add chunk preprocessing
  private preprocessChunk(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  // Add metadata enrichment
  private enrichChunkMetadata(doc: Document): Document {
    const metadata = {
      ...doc.metadata,
      chunk_type: 'text',
      word_count: doc.pageContent.split(/\s+/).length,
      processed_date: new Date().toISOString()
    };
    return new Document({
      pageContent: this.preprocessChunk(doc.pageContent),
      metadata
    });
  }

  // Add chunk scoring
  private scoreChunk(chunk: string): number {
    const wordCount = chunk.split(/\s+/).length;
    const sentenceCount = chunk.split(/[.!?]+/).length;
    return wordCount > 10 && sentenceCount > 0 ? 1 : 0;
  }

  public async initializeVectorStoreFromDocuments(
    documents: Document[],
    embeddings: Embeddings
  ) {
    try {
      console.log("🔄 Préparation des documents...");
      
      // Validate and preprocess documents
      const validDocuments = documents
        .filter(doc => doc.pageContent && doc.pageContent.trim().length > 50)
        .map(doc => this.enrichChunkMetadata(doc));
      
      // Split documents into chunks
      const texts = await this.textSplitter.splitDocuments(validDocuments);
      console.log(`📄 ${texts.length} chunks créés`);
      
      // Score and filter chunks
      const scoredTexts = texts.filter(doc => this.scoreChunk(doc.pageContent) > 0);
      console.log(`📄 ${scoredTexts.length} chunks valides après scoring`);
      
      // Deduplicate chunks
      const uniqueTexts = this.deduplicateChunks(scoredTexts);
      console.log(`📄 ${uniqueTexts.length} chunks uniques après déduplication`);
      
      // Initialize vector store with optimized settings
      this.vectorStore = await Chroma.fromDocuments(
        uniqueTexts,
        embeddings,
        {
          collectionName: "uploaded_docs",
          url: "http://chroma:8000",
          collectionMetadata: {
            "hnsw:space": "cosine",
            "hnsw:construction_ef": 100,  // Increased for better index quality
            "hnsw:search_ef": 50,         // Balanced for search performance
            "hnsw:m": 16                  // Number of connections per element
          }
        }
      );
      
      console.log("✅ VectorStore initialisé avec succès");
      return {
        totalDocuments: documents.length,
        validChunks: uniqueTexts.length,
        averageChunkSize: this.calculateAverageChunkSize(uniqueTexts)
      };
    } catch (error) {
      console.error("❌ Erreur lors de l'initialisation:", error);
      throw new Error(`Erreur d'initialisation du VectorStore: ${error.message}`);
    }
  }

  private calculateAverageChunkSize(chunks: Document[]): number {
    if (chunks.length === 0) return 0;
    const totalLength = chunks.reduce((sum, doc) => sum + doc.pageContent.length, 0);
    return Math.round(totalLength / chunks.length);
  }

  private deduplicateChunks(chunks: Document[]): Document[] {
    const seen = new Set<string>();
    return chunks.filter(chunk => {
      const normalized = chunk.pageContent
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  public async searchSimilarDocuments(query: string, limit: number = 5) {
    if (!this.vectorStore) {
      console.warn("⚠️ VectorStore non initialisé");
      return [];
    }

    try {
      console.log("🔍 Recherche pour:", query);
      
      const initialResults = await this.vectorStore.similaritySearch(
        query,
        limit * 2,
        { 
          filter: { source: { $exists: true } },
          minScore: 0.7
        }
      );
      
      const scoredResults = initialResults
        .filter(doc => doc.pageContent.trim().length > 50)
        .map(doc => ({
          document: doc,
          score: this.calculateRelevanceScore(query, doc.pageContent)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => {
          const doc = item.document;
          const pageNumber = doc.metadata.page_number || doc.metadata.pageNumber || 1;
          const title = doc.metadata.title || 'Document';
          const source = doc.metadata.source;
          
          // Préparer le texte à surligner
          const searchText = doc.pageContent
            .substring(0, 200)
            .replace(/[\n\r]+/g, ' ')
            .trim();
          
          return new Document({
            pageContent: doc.pageContent,
            metadata: {
              title: title,
              pageNumber: pageNumber,
              source: source,
              type: doc.metadata.type || 'uploaded',
              searchText: searchText,
              url: source ? 
                `/api/uploads/${source}/view?page=${pageNumber}&search=${encodeURIComponent(searchText)}` : 
                undefined
            }
          });
        });

      const mergedResults = this.mergeRelatedChunks(scoredResults);
      console.log(`📄 ${mergedResults.length} documents pertinents trouvés après reranking`);
      return mergedResults;
    } catch (error) {
      console.error("❌ Erreur de recherche:", error);
      return [];
    }
  }

  private calculateRelevanceScore(query: string, content: string): number {
    const normalizedQuery = query.toLowerCase();
    const normalizedContent = content.toLowerCase();
    
    // Basic relevance scoring based on multiple factors
    let score = 0;
    
    // Term frequency
    const queryTerms = normalizedQuery.split(/\s+/);
    queryTerms.forEach(term => {
      const termCount = (normalizedContent.match(new RegExp(term, 'g')) || []).length;
      score += termCount * 0.1;
    });
    
    // Exact phrase matching
    if (normalizedContent.includes(normalizedQuery)) {
      score += 1;
    }
    
    // Content length penalty (prefer shorter, more focused chunks)
    const lengthPenalty = Math.max(0, 1 - (content.length / 5000));
    score *= (1 + lengthPenalty);
    
    return score;
  }

  private mergeRelatedChunks(documents: Document[]): Document[] {
    const merged: { [key: string]: Document } = {};
    
    documents.forEach(doc => {
      const source = doc.metadata?.source || '';
      const page = doc.metadata?.pageNumber || 1;
      const key = `${source}-${page}`;
      
      if (!merged[key]) {
        merged[key] = doc;
      } else {
        const existingDoc = merged[key];
        merged[key] = new Document({
          pageContent: `${existingDoc.pageContent}\n\n${doc.pageContent}`,
          metadata: {
            ...existingDoc.metadata,
            searchText: existingDoc.metadata.searchText
          }
        });
      }
    });
    
    return Object.values(merged);
  }

  public createSearchChain(llm: BaseChatModel) {
    return RunnableSequence.from([
      RunnableMap.from({
        query: (input: SearchInput) => input.query,
        chat_history: (input: SearchInput) => formatChatHistoryAsString(input.chat_history),
        context: async (input: SearchInput) => {
          const docs = await this.searchSimilarDocuments(input.query);
          return docs.map((doc, i) => {
            const source = doc.metadata?.source || 'Document';
            const title = doc.metadata?.title || '';
            const pageNumber = doc.metadata?.pageNumber;
            const url = doc.metadata?.url;
            
            let sourceInfo = `Source: ${title || source}`;
            if (pageNumber) sourceInfo += ` (page ${pageNumber})`;
            if (url) sourceInfo += `\nURL: ${url}`;
            
            return `[Source ${i + 1}] ${doc.pageContent}\n${sourceInfo}`;
          }).join("\n\n");
        }
      }),
      PromptTemplate.fromTemplate(`
        Tu es un assistant expert qui répond aux questions en se basant uniquement sur le contexte fourni.
        Historique de la conversation:
        {chat_history}

        Contexte disponible:
        {context}

        Question: {query}

        Instructions:
        1. Réponds uniquement en te basant sur le contexte fourni
        2. Si la réponse n'est pas dans le contexte, dis-le clairement
        3. Cite les sources pertinentes en utilisant [Source X]
        4. Sois précis et concis

        Réponse:
      `),
      llm,
      new StringOutputParser()
    ]);
  }

  public isInitialized(): boolean {
    return this.vectorStore !== null;
  }
} 