import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableSequence, RunnableMap } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';

type SearchInput = {
  query: string;
  chat_history: BaseMessage[];
  type?: string;
};

export class RAGDocumentChain {
  private static instance: RAGDocumentChain;
  private vectorStore: Chroma | null = null;
  private readonly collectionName = 'uploaded_docs';
  private initialized = false;
  private currentDocuments: Document[] = [];

  private constructor() {}

  public static getInstance(): RAGDocumentChain {
    if (!RAGDocumentChain.instance) {
      RAGDocumentChain.instance = new RAGDocumentChain();
    }
    return RAGDocumentChain.instance;
  }

  public async initializeVectorStoreFromDocuments(
    documents: Document[],
    embeddings: Embeddings
  ) {
    try {
      // Filtrer les documents invalides
      const validDocuments = documents.filter(doc => 
        doc.pageContent && 
        typeof doc.pageContent === 'string' && 
        doc.pageContent.trim().length > 0
      );

      console.log(`📄 Documents valides: ${validDocuments.length}/${documents.length}`);
      
      // Si déjà initialisé avec les mêmes documents, ne rien faire
      const sameDocuments = this.initialized && 
        this.currentDocuments.length === validDocuments.length &&
        validDocuments.every((doc, index) => 
          doc.pageContent === this.currentDocuments[index].pageContent
        );

      if (sameDocuments) {
        console.log("📚 Réutilisation de la collection existante");
        return {
          totalDocuments: documents.length,
          validDocuments: this.currentDocuments.length,
          reused: true
        };
      }
      
      if (!this.vectorStore) {
        console.log("🔄 Initialisation du vectorStore");
        this.vectorStore = await Chroma.fromDocuments(validDocuments, embeddings, {
          collectionName: this.collectionName,
          url: "http://chroma:8000"
        });
        this.initialized = true;
      } else {
        console.log("🔄 Réinitialisation de la collection");
        // Créer une nouvelle instance avec les nouveaux documents
        this.vectorStore = await Chroma.fromDocuments(validDocuments, embeddings, {
          collectionName: this.collectionName,
          url: "http://chroma:8000"
        });
        this.initialized = true;
      }

      this.currentDocuments = validDocuments;
      
      return {
        totalDocuments: documents.length,
        validDocuments: validDocuments.length,
        reused: false
      };
    } catch (error) {
      console.error("❌ Erreur lors de l'initialisation:", error);
      throw new Error(`Erreur d'initialisation du VectorStore: ${error.message}`);
    }
  }

  public async searchSimilarDocuments(query: string, limit: number = 5) {
    if (!this.vectorStore || !this.initialized) {
      throw new Error("VectorStore non initialisé");
    }

    try {
      console.log("🔍 Recherche pour:", query);
      
      const results = await this.vectorStore.similaritySearch(query, limit, {
        k: limit
      });
      
      console.log(`📄 ${results.length} documents pertinents trouvés`);
      return results;
    } catch (error) {
      console.error("❌ Erreur de recherche:", error);
      return this.currentDocuments.slice(0, limit);
    }
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
            return `[Source ${i + 1}] ${doc.pageContent}\nSource: ${source}`;
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
