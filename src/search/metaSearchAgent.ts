import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from '@langchain/core/prompts';
import {
  RunnableLambda,
  RunnableMap,
  RunnableSequence,
} from '@langchain/core/runnables';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import LineListOutputParser from '../lib/outputParsers/listLineOutputParser';
import LineOutputParser from '../lib/outputParsers/lineOutputParser';
import { getDocumentsFromLinks } from '../utils/documents';
import { Document } from 'langchain/document';
import { searchSearxng } from '../lib/searxng';
import path from 'path';
import fs from 'fs';
import computeSimilarity from '../utils/computeSimilarity';
import formatChatHistoryAsString from '../utils/formatHistory';
import eventEmitter from 'events';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import handleImageSearch from '../chains/imageSearchAgent';
import handleExpertSearch from '../chains/expertSearchAgent';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { RAGDocumentChain } from '../chains/rag_document_upload';
import { SearxngSearchOptions } from '../lib/searxng';
import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { EventEmitter } from 'events';

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
  ) => Promise<eventEmitter>;
}

interface Config {
  activeEngines: string[];
  queryGeneratorPrompt: string;
  responsePrompt: string;
  rerank: boolean;
  rerankThreshold: number;
  searchWeb: boolean;
  summarizer: boolean;
  searchDatabase: boolean;
  provider?: string;
  model?: string;
  customOpenAIBaseURL?: string;
  customOpenAIKey?: string;
}

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

interface SearchResponse {
  text: string;
  sources: Array<{
    title: string;
    content: string;
    url?: string;
    source?: string;
  }>;
  illustrationImage?: string;
}

// Ajouter l'interface pour les métadonnées des documents
interface DocumentMetadata {
  title?: string;
  source?: string;
  fileId?: string;
  url?: string;  // Ajout de l'url optionnelle
}

interface SearchResult {
  pageContent: string;
  metadata: {
    score?: number;
    title?: string;
    [key: string]: any;
  };
}

export class MetaSearchAgent implements MetaSearchAgentType {
  private config: Config;
  private strParser = new StringOutputParser();
  private fileIds: string[];

  constructor(config: Config) {
    this.config = config;
    this.fileIds = [];
  }

  private async createSearchRetrieverChain(llm: BaseChatModel) {
    (llm as unknown as ChatOpenAI).temperature = 0;

    return RunnableSequence.from([
      PromptTemplate.fromTemplate(this.config.queryGeneratorPrompt),
      llm,
      this.strParser,
      RunnableLambda.from(async (input: string) => {
        const linksOutputParser = new LineListOutputParser({
          key: 'links',
        });

        const questionOutputParser = new LineOutputParser({
          key: 'question',
        });

        const links = await linksOutputParser.parse(input);
        let question = this.config.summarizer
          ? await questionOutputParser.parse(input)
          : input;

        if (question === 'not_needed') {
          return { query: '', docs: [] };
        }

        let documents: Document[] = [];

        // Recherche web si activée
        if (this.config.searchWeb) {
          const res = await searchSearxng(question, {
            language: 'fr',
            engines: this.config.activeEngines,
          });

          documents = res.results.map(
            (result) =>
              new Document({
                pageContent: result.content,
                metadata: {
                  title: result.title,
                  url: result.url,
                  type: 'web',
                  ...(result.img_src && { img_src: result.img_src }),
                },
              }),
          );
        }

        // Recherche d'experts si activée
        if (this.config.searchDatabase) {
          try {
            console.log("🔍 Recherche d'experts...");
            const expertResults = await handleExpertSearch(
              {
                query: question,
                chat_history: [],
                messageId: 'search_' + Date.now(),
                chatId: 'chat_' + Date.now()
              },
              llm
            );

            console.log("🔍 Experts trouvés:", expertResults.experts.length);
            const expertDocs = expertResults.experts.map(expert => 
              new Document({
                pageContent: `Expert: ${expert.prenom} ${expert.nom}
                Spécialité: ${expert.specialite}
                Ville: ${expert.ville}
                Tarif: ${expert.tarif}€
                Expertises: ${expert.expertises}
                Services: ${JSON.stringify(expert.services)}
                ${expert.biographie}`,
                metadata: {
                  type: 'expert',
                  expert: true,
                  expertData: expert,
                  title: `${expert.specialite} - ${expert.ville}`,
                  url: `/expert/${expert.id_expert}`,
                  image_url: expert.image_url
                }
              })
            );

            documents = [...expertDocs, ...documents];
          } catch (error) {
            console.error("Erreur lors de la recherche d'experts:", error);
          }
        }

        // Trier pour mettre les experts en premier
        documents.sort((a, b) => {
          if (a.metadata?.type === 'expert' && b.metadata?.type !== 'expert') return -1;
          if (a.metadata?.type !== 'expert' && b.metadata?.type === 'expert') return 1;
          return 0;
        });

        return { query: question, docs: documents };
      }),
    ]);
  }

  private async loadUploadedDocuments(fileIds: string[]): Promise<Document[]> {
    console.log("📂 Chargement des documents:", fileIds);
    const docs: Document[] = [];
    
    for (const fileId of fileIds) {
      try {
        const filePath = path.join(process.cwd(), 'uploads', fileId);
        const contentPath = `${filePath}-extracted.json`;
        const embeddingsPath = `${filePath}-embeddings.json`;
        
        if (!fs.existsSync(contentPath)) {
          throw new Error(`Fichier non trouvé: ${contentPath}`);
        }

        // Charger le contenu et les embeddings pré-calculés
        const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
        const embeddingsData = fs.existsSync(embeddingsPath) 
          ? JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'))
          : null;
        
        if (!content.contents || !Array.isArray(content.contents)) {
          throw new Error(`Structure de contenu invalide pour ${fileId}`);
        }

        // Calculer le nombre de chunks par page
        const chunksPerPage = Math.ceil(content.contents.length / (content.pageCount || 10));
        
        content.contents.forEach((chunk: any, index: number) => {
          const pageNumber = Math.floor(index / chunksPerPage) + 1;
          const doc = new Document({
            pageContent: typeof chunk === 'string' ? chunk : chunk.content,
            metadata: {
              ...(typeof chunk === 'object' ? chunk.metadata : {}),
              source: fileId,
              title: content.title || 'Document sans titre',
              pageNumber: pageNumber,
              chunkIndex: index,
              totalChunks: content.contents.length,
              type: 'uploaded',
              embedding: embeddingsData?.embeddings[index]?.vector,
              searchText: (typeof chunk === 'string' ? chunk : chunk.content)
                .substring(0, 100)
                .replace(/[\n\r]+/g, ' ')
                .trim()
            }
          });
          docs.push(doc);
        });

        console.log(`📑 Documents chargés depuis ${fileId}:`, docs.length);
      } catch (error) {
        console.error(`❌ Erreur lors du chargement du fichier ${fileId}:`, error);
      }
    }

    return docs;
  }

  private async createAnsweringChain(
    llm: BaseChatModel,
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
  ) {
    return RunnableSequence.from([
      RunnableMap.from({
        query: (input: BasicChainInput) => input.query,
        chat_history: (input: BasicChainInput) => input.chat_history,
        docs: RunnableLambda.from(async (input: BasicChainInput) => {
          console.log("Début de la recherche...");
          let docs: Document[] = [];

          // 1. D'abord chercher dans les documents uploadés
          if (fileIds.length > 0) {
            try {
              const uploadedDocs = await this.loadUploadedDocuments(fileIds);
              console.log("📚 Documents uploadés chargés:", uploadedDocs.length);

              // Utiliser RAGDocumentChain pour la recherche dans les documents
              const ragChain = new RAGDocumentChain();
              await ragChain.initializeVectorStoreFromDocuments(uploadedDocs, embeddings);
              
              // Utiliser le type 'specific' pour une recherche précise
              const searchChain = ragChain.createSearchChain(llm);
              const relevantDocs = await searchChain.invoke({
                query: input.query,
                chat_history: input.chat_history,
                type: 'specific'
              });

              // Ajouter les documents pertinents avec un score élevé
              docs = uploadedDocs.map(doc => ({
                ...doc,
                metadata: {
                  ...doc.metadata,
                  score: 0.8 // Score élevé pour les documents uploadés
                }
              }));

              console.log("📄 Documents pertinents trouvés:", docs.length);
            } catch (error) {
              console.error("❌ Erreur lors de la recherche dans les documents:", error);
            }
          }

          // 2. Ensuite chercher les experts si pertinent
          if (this.config.searchDatabase) {
            try {
              console.log("👥 Recherche d'experts...");
              const expertResults = await handleExpertSearch(
                {
                  query: input.query,
                  chat_history: input.chat_history,
                  messageId: 'search_' + Date.now(),
                  chatId: 'chat_' + Date.now()
                },
                llm
              );
              
              if (expertResults.experts.length > 0) {
                const expertDocs = this.convertExpertsToDocuments(expertResults.experts);
                docs = [...docs, ...expertDocs];
              }
            } catch (error) {
              console.error("❌ Erreur lors de la recherche d'experts:", error);
            }
          }

          // 3. Enfin, compléter avec la recherche web si nécessaire et si peu de résultats
          if (this.config.searchWeb && docs.length < 3) {
            try {
              const webResults = await this.performWebSearch(input.query);
              docs = [...docs, ...webResults];
            } catch (error) {
              console.error("❌ Erreur lors de la recherche web:", error);
            }
          }

          console.log("🔍 DEBUG - Avant appel rerankDocs - Mode:", optimizationMode, "Query:", input.query);
          return this.rerankDocs(
            input.query,
            docs,
            fileIds,
            embeddings,
            optimizationMode,
            llm
          );
        }).withConfig({ runName: 'FinalSourceRetriever' }),
      }),

      RunnableMap.from({
        query: (input) => input.query,
        chat_history: (input) => input.chat_history,
        date: () => new Date().toISOString(),
        context: (input) => {
          console.log("Préparation du contexte...");
          return this.processDocs(input.docs);
        },
        docs: (input) => input.docs,
      }),

      ChatPromptTemplate.fromMessages([
        ['system', this.config.responsePrompt],
        new MessagesPlaceholder('chat_history'),
        ['user', '{context}\n\n{query}'],
      ]),
      llm,
      this.strParser,
    ]).withConfig({ runName: 'FinalResponseGenerator' });
  }

  private convertExpertsToDocuments(experts: any[]) {
    return experts.map(expert => 
      new Document({
        pageContent: `Expert: ${expert.prenom} ${expert.nom}
        Spécialité: ${expert.specialite}
        Ville: ${expert.ville}
        Tarif: ${expert.tarif}€
        Expertises: ${expert.expertises}
        Services: ${JSON.stringify(expert.services)}
        ${expert.biographie}`,
        metadata: {
          type: 'expert',
          expert: true,
          expertData: expert,
          title: `${expert.specialite} - ${expert.ville}`,
          url: `/expert/${expert.id_expert}`,
          image_url: expert.image_url
        }
      })
    );
  }

  private async performWebSearch(query: string) {
    const res = await searchSearxng(query, {
      language: 'fr',
      engines: this.config.activeEngines,
    });

    return res.results.map(result =>
      new Document({
        pageContent: result.content,
        metadata: {
          title: result.title,
          url: result.url,
          type: 'web',
          ...(result.img_src && { img_src: result.img_src }),
        },
      })
    );
  }

  private processDocs(docs: Document[]) {
    // Trier les documents par score si disponible
    const sortedDocs = docs.sort((a, b) => 
      (b.metadata?.score || 0) - (a.metadata?.score || 0)
    );

    // Limiter à 5 documents maximum
    const limitedDocs = sortedDocs.slice(0, 5);

    // Limiter la taille de chaque document à 1000 caractères
    return limitedDocs
      .map((doc, index) => {
        const content = doc.pageContent.length > 1000 
          ? doc.pageContent.substring(0, 1000) + "..."
          : doc.pageContent;
          
        return `${content} [${index + 1}]`;
      })
      .join('\n\n');
  }

  private async handleStream(
    stream: IterableReadableStream<StreamEvent>,
    emitter: eventEmitter,
  ) {
    for await (const event of stream) {
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalSourceRetriever'
      ) {
        const sources = event.data.output;
        
        // Normaliser les sources pour le frontend
        const normalizedSources = sources?.map(source => {
          const isUploadedDoc = source.metadata?.type === 'uploaded';
          const isExpert = source.metadata?.type === 'expert';
          const pageNumber = source.metadata?.pageNumber || 1;
          const sourceId = source.metadata?.source;
          
          // Construire l'URL selon le type de source
          let url;
          if (isUploadedDoc && sourceId) {
            url = `/api/uploads/${sourceId}/content?page=${pageNumber}`;
          } else if (isExpert) {
            url = source.metadata?.url;
          } else if (source.metadata?.type === 'web') {
            url = source.metadata?.url;
          }
          
          // Construire un titre descriptif
          let title = source.metadata?.title || '';
          if (isUploadedDoc && title) {
            title = `${title} - Page ${pageNumber}`;
          } else if (isExpert) {
            title = source.metadata?.displayTitle || title;
          }
          
          // Limiter la taille du contenu pour éviter les erreurs de payload
          const limitedContent = source.pageContent?.substring(0, 1000) || '';
          
          return {
            pageContent: limitedContent,
            metadata: {
              title: title,
              type: source.metadata?.type || 'web',
              url: url,
              source: sourceId,
              pageNumber: pageNumber,
              searchText: source.metadata?.searchText?.substring(0, 200) || limitedContent.substring(0, 200),
              expertData: source.metadata?.expertData,
              illustrationImage: source.metadata?.illustrationImage,
              imageTitle: source.metadata?.imageTitle,
              favicon: source.metadata?.favicon,
              linkText: source.metadata?.linkText,
              expertName: source.metadata?.expertName
            }
          };
        }) || [];

        console.log("🔍 Sources normalisées:", normalizedSources.length);
        
        emitter.emit(
          'data',
          JSON.stringify({ 
            type: 'sources', 
            data: normalizedSources,
            illustrationImage: normalizedSources[0]?.metadata?.illustrationImage || null,
            imageTitle: normalizedSources[0]?.metadata?.imageTitle || null
          })
        );
      }
      if (
        event.event === 'on_chain_stream' &&
        event.name === 'FinalResponseGenerator'
      ) {
        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: event.data.chunk })
        );
      }
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalResponseGenerator'
      ) {
        emitter.emit('end');
      }
    }
  }

  private async searchExperts(
    query: string, 
    embeddings: Embeddings,
    llm: BaseChatModel
  ): Promise<SearchResult[]> {
    try {
      console.log("👥 Recherche d'experts pour:", query);
      const expertResults = await handleExpertSearch(
        {
          query,
          chat_history: [],
          messageId: 'search_' + Date.now(),
          chatId: 'chat_' + Date.now()
        },
        llm
      );

      return expertResults.experts.map(expert => ({
        pageContent: `Expert: ${expert.prenom} ${expert.nom}
        Spécialité: ${expert.specialite}
        Ville: ${expert.ville}
        Tarif: ${expert.tarif}€
        Expertises: ${expert.expertises}
        Services: ${JSON.stringify(expert.services)}
        ${expert.biographie}`,
        metadata: {
          type: 'expert',
          expert: true,
          expertData: expert,
          title: `${expert.prenom} ${expert.nom} - ${expert.specialite}`,
          url: `/expert/${expert.id_expert}`,
          image_url: expert.image_url,
          score: 0.6 // Score moyen pour les experts
        }
      }));
    } catch (error) {
      console.error("❌ Erreur lors de la recherche d'experts:", error);
      return [];
    }
  }

  private async searchWeb(query: string): Promise<SearchResult[]> {
    try {
      console.log("🌐 Recherche web pour:", query);
      const res = await searchSearxng(query, {
        language: 'fr',
        engines: this.config.activeEngines,
      });

      return res.results.map(result => ({
        pageContent: result.content,
        metadata: {
          title: result.title,
          url: result.url,
          type: 'web',
          score: 0.4, // Score plus faible pour les résultats web
          ...(result.img_src && { img_src: result.img_src }),
        }
      }));
    } catch (error) {
      console.error("❌ Erreur lors de la recherche web:", error);
      return [];
    }
  }

  private async rerankDocs(
    query: string,
    docs: Document[],
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    llm: BaseChatModel
  ) {
    console.log("🔍 Mode d'optimisation:", optimizationMode);
    console.log("🔍 Query pour la recherche d'image:", query);
    
    if (optimizationMode === 'balanced' || optimizationMode === 'quality') {
      console.log("🔍 Démarrage de la recherche d'images...");
      try {
        console.log("🔍 Appel de handleImageSearch avec la query:", query);
        const images = await handleImageSearch(
          {
            query,
            chat_history: [],
          },
          llm
        );
        console.log("🔍 Résultat brut de handleImageSearch:", JSON.stringify(images, null, 2));
        console.log("🔍 Images trouvées:", images?.length);
        
        if (images && images.length > 0) {
          console.log("🔍 Première image trouvée:", {
            src: images[0].img_src,
            title: images[0].title,
            url: images[0].url
          });
          return docs.slice(0, 15).map(doc => ({
            ...doc,
            metadata: {
              ...doc.metadata,
              illustrationImage: images[0].img_src,
              title: images[0].title
            }
          }));
        } else {
          console.log("⚠️ Aucune image trouvée dans le résultat");
        }
      } catch (error) {
        console.error("❌ Erreur détaillée lors de la recherche d'image:", {
          message: error.message,
          stack: error.stack
        });
      }
    } else {
      console.log("🔍 Mode speed: pas de recherche d'images");
    }

    return docs.slice(0, 15);
  }

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
  ) {
    const effectiveMode = 'balanced';
    
    const emitter = new eventEmitter();

    try {
      // Analyse sophistiquée de la requête avec LLM
      const queryAnalysis = await llm.invoke(`En tant qu'expert en analyse de requêtes, examine cette demande et détermine la stratégie de recherche optimale.

Question/Requête: "${message}"

Documents disponibles: ${fileIds.length > 0 ? "Oui" : "Non"}

Analyse et réponds au format JSON:
{
  "primaryIntent": "DOCUMENT_QUERY" | "WEB_SEARCH" | "EXPERT_ADVICE" | "HYBRID",
  "requiresDocumentSearch": <boolean>,
  "requiresWebSearch": <boolean>,
  "requiresExpertSearch": <boolean>,
  "documentRelevance": <0.0 à 1.0>,
  "reasoning": "<courte explication>"
}

Critères d'analyse:
- DOCUMENT_QUERY: La question porte spécifiquement sur le contenu des documents
- WEB_SEARCH: Recherche d'informations générales ou actuelles
- EXPERT_ADVICE: Demande nécessitant une expertise spécifique
- HYBRID: Combinaison de plusieurs sources

Prends en compte:
- La présence ou non de documents uploadés
- La spécificité de la question
- Le besoin d'expertise externe
- L'actualité du sujet`);

      const analysis = JSON.parse(String(queryAnalysis.content));
      console.log("🎯 Analyse de la requête:", analysis);

      // 1. Analyse des documents uploadés avec RAG
      const uploadedDocs = await this.loadUploadedDocuments(fileIds);
      console.log("📚 Documents uploadés chargés:", uploadedDocs.length);
      
      if (uploadedDocs.length > 0) {
        // Création du vectorStore temporaire pour les documents
        const vectorStore = await Chroma.fromDocuments(uploadedDocs, embeddings, {
          collectionName: "temp_docs",
          url: "http://chroma:8000",
          numDimensions: 1536
        });

        // Recherche sémantique sans filtre pour l'instant
        const relevantDocs = await vectorStore.similaritySearch(message, 5);
        
        console.log("📄 Documents pertinents trouvés:", relevantDocs.length);

        // Extraction du contexte pour enrichir la recherche
        const documentContext = relevantDocs
          .map(doc => doc.pageContent)
          .join("\n")
          .substring(0, 500);
        
        const documentTitle = uploadedDocs[0]?.metadata?.title || "";
        const enrichedQuery = `${message} ${documentTitle} ${documentContext}`;

        // 2. Recherche d'experts en BDD
        const expertResults = await this.searchExperts(message, embeddings, llm);
        
        // 3. Recherche web complémentaire avec le contexte enrichi
        const webResults = await this.searchWeb(enrichedQuery);

        // Combinaison des résultats avec les scores appropriés
        const combinedResults = [
          ...relevantDocs.map(doc => ({
            ...doc,
            metadata: {
              ...doc.metadata,
              score: 0.8 // Score élevé pour les documents uploadés
            }
          })),
          ...expertResults.map(expert => ({
            ...expert,
            metadata: {
              ...expert.metadata,
              score: 0.6 // Score moyen pour les experts
            }
          })),
          ...webResults.map(web => ({
            ...web,
            metadata: {
              ...web.metadata,
              score: 0.4 // Score plus faible pour les résultats web
            }
          }))
        ];

        // Tri et sélection des meilleurs résultats
        const finalResults = await this.rerankDocs(
          message,
          combinedResults,
          fileIds,
          embeddings,
          effectiveMode,
          llm
        );

        // Création de la chaîne de réponse
        const answeringChain = await this.createAnsweringChain(
          llm,
          fileIds,
          embeddings,
          effectiveMode
        );

        const stream = answeringChain.streamEvents(
          {
            chat_history: history,
            query: `${message}\n\nContexte pertinent:\n${finalResults.map(doc => doc.pageContent).join('\n\n')}`
          },
          {
            version: 'v1'
          }
        );

        this.handleStream(stream, emitter);
      } else {
        // Fallback sans documents uploadés
        const answeringChain = await this.createAnsweringChain(
          llm,
          fileIds,
          embeddings,
          effectiveMode
        );

        const stream = answeringChain.streamEvents(
          {
            chat_history: history,
            query: message
          },
          {
            version: 'v1'
          }
        );

        this.handleStream(stream, emitter);
      }
    } catch (error) {
      console.error("❌ Erreur:", error);
      // Fallback en mode standard
      const answeringChain = await this.createAnsweringChain(
        llm,
        fileIds,
        embeddings,
        effectiveMode
      );

      const stream = answeringChain.streamEvents(
        {
          chat_history: history,
          query: message
        },
        {
          version: 'v1'
        }
      );

      this.handleStream(stream, emitter);
    }

    return emitter;
  }
}

export const searchHandlers: Record<string, MetaSearchAgentType> = {
  // ... existing handlers ...
  legal: {
    searchAndAnswer: async (
      message,
      history,
      llm,
      embeddings,
      optimizationMode,
      fileIds,
    ) => {
      const emitter = new eventEmitter();

      try {
        const chain = new RAGDocumentChain();
        await chain.initializeVectorStoreFromDocuments(fileIds.map(fileId => new Document({
          pageContent: '',
          metadata: { source: fileId }
        })), embeddings);

        const searchChain = chain.createSearchChain(llm);
        const results = await searchChain.invoke({
          query: message,
          chat_history: history,
          type: 'legal'
        });

        // Convertir le résultat en objet SearchResponse
        const response: SearchResponse = {
          text: results,
          sources: [] // Sources vides par défaut
        };

        // Émettre la réponse
        emitter.emit(
          'data',
          JSON.stringify({
            type: 'response',
            data: response.text,
          })
        );

        emitter.emit('end');
      } catch (error) {
        emitter.emit(
          'error',
          JSON.stringify({
            type: 'error',
            data: error.message,
          })
        );
      }

      return emitter;
    },
  },
  documents: {
    searchAndAnswer: async (
      message,
      history,
      llm,
      embeddings,
      optimizationMode,
      fileIds,
    ) => {
      const emitter = new eventEmitter();
      const ragChain = new RAGDocumentChain();

      try {
        const docs = fileIds.map(fileId => {
          const filePath = path.join(process.cwd(), 'uploads', fileId);
          const contentPath = filePath + '-extracted.json';
          const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
          return new Document<DocumentMetadata>({
            pageContent: content.contents.join('\n'),
            metadata: {
              title: content.title,
              source: fileId,
            }
          });
        });

        await ragChain.initializeVectorStoreFromDocuments(docs, embeddings);
        const chain = ragChain.createSearchChain(llm);
        const result = await chain.invoke({
          query: message,
          chat_history: history,
          type: 'document_search'
        });

        // Convertir le résultat en objet SearchResponse
        const response: SearchResponse = {
          text: result,
          sources: docs.map(doc => ({
            title: doc.metadata?.title || '',
            content: doc.pageContent,
            source: doc.metadata?.source || 'uploaded_docs'
          }))
        };

        emitter.emit('data', JSON.stringify({
          type: 'response',
          data: response.text
        }));

        emitter.emit('data', JSON.stringify({
          type: 'sources',
          data: response.sources
        }));

        emitter.emit('end');
      } catch (error) {
        emitter.emit('error', JSON.stringify({
          type: 'error',
          data: error.message
        }));
      }

      return emitter;
    }
  },
  uploads: {
    searchAndAnswer: async (
      message,
      history,
      llm,
      embeddings,
      optimizationMode,
      fileIds,
    ) => {
      const emitter = new eventEmitter();

      try {
        // Analyse du type de requête avec LLM pour plus de précision
        const queryIntent = await llm.invoke(`
          Analysez cette requête et déterminez son intention principale :
          1. SUMMARY (demande de résumé ou synthèse globale)
          2. ANALYSIS (demande d'analyse ou d'explication)
          3. SPECIFIC (question spécifique sur le contenu)
          4. COMPARE (demande de comparaison)

          Requête : "${message}"
          
          Répondez uniquement avec l'intention.
        `);

        const intent = String(queryIntent.content).trim();
        console.log("🎯 Intention détectée:", intent);

        // Chargement optimisé des documents
        const docs = await Promise.all(fileIds.map(async fileId => {
          const filePath = path.join(process.cwd(), 'uploads', fileId);
          const contentPath = `${filePath}-extracted.json`;
          
          if (!fs.existsSync(contentPath)) {
            throw new Error(`Fichier non trouvé: ${contentPath}`);
          }

          const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
          
          // Optimisation : Chunking plus efficace
          const chunkSize = 1000; // Taille optimale pour le traitement
          const overlap = 100; // Chevauchement pour maintenir le contexte
          
          const chunks = [];
          let currentChunk = '';
          let currentSize = 0;
          
          content.contents.forEach((text: string) => {
            currentChunk += text + ' ';
            currentSize += text.length;
            
            if (currentSize >= chunkSize) {
              chunks.push(currentChunk);
              // Garder le chevauchement pour le prochain chunk
              currentChunk = currentChunk.slice(-overlap);
              currentSize = overlap;
            }
          });
          
          if (currentChunk) {
            chunks.push(currentChunk);
          }
          
          return chunks.map((chunk, index) => {
            const pageNumber = Math.floor(index / (chunks.length / (content.pageCount || 1))) + 1;
            
            return new Document({
              pageContent: chunk,
              metadata: {
                title: content.title || 'Document sans titre',
                source: fileId,
                type: 'uploaded',
                url: `/api/uploads/${fileId}/view?page=${pageNumber}`,
                pageNumber: pageNumber,
                chunkIndex: index,
                totalChunks: chunks.length,
                searchText: chunk.substring(0, 100).replace(/[\n\r]+/g, ' ').trim()
              }
            });
          });
        }));

        const flatDocs = docs.flat();
        console.log("📚 Nombre total de chunks:", flatDocs.length);

        const ragChain = new RAGDocumentChain();
        await ragChain.initializeVectorStoreFromDocuments(flatDocs, embeddings);
        const chain = ragChain.createSearchChain(llm);

        // Adaptation de la requête selon l'intention détectée par le LLM
        let queryPrompt = message;
        switch(intent) {
          case 'SUMMARY':
            queryPrompt = "Fais un résumé complet et structuré de ce document en te concentrant sur les points clés";
            break;
          case 'ANALYSIS':
            queryPrompt = `Analyse en détail les aspects suivants du document concernant : ${message}. Fournis une analyse structurée avec des exemples du texte.`;
            break;
          case 'SPECIFIC':
            // Garde la question originale mais ajoute du contexte
            queryPrompt = `En te basant sur le contenu du document, réponds précisément à cette question : ${message}`;
            break;
          case 'COMPARE':
            queryPrompt = `Compare et analyse en détail les différents aspects concernant : ${message}. Structure ta réponse par points de comparaison.`;
            break;
        }

        // Stream optimisé avec émission rapide des sources
        const stream = await chain.streamEvents(
          {
            query: queryPrompt,
            chat_history: history,
            type: intent.toLowerCase()
          },
          { version: 'v1' }
        );

        // Gestion optimisée du stream
        let sourcesEmitted = false;
        for await (const event of stream) {
          if (event.event === 'on_chain_stream') {
            emitter.emit(
              'data',
              JSON.stringify({
                type: 'response',
                data: event.data.chunk
              })
            );
          }
          
          // Émettre les sources plus tôt dans le processus
          if (!sourcesEmitted && event.event === 'on_chain_start') {
            const sources = flatDocs.slice(0, 5).map(doc => ({
              title: doc.metadata?.title || '',
              content: doc.metadata?.searchText || '',
              url: doc.metadata?.url,
              source: doc.metadata?.source,
              type: 'uploaded',
              pageNumber: doc.metadata?.pageNumber
            }));

            emitter.emit(
              'data',
              JSON.stringify({
                type: 'sources',
                data: sources
              })
            );
            sourcesEmitted = true;
          }

          if (event.event === 'on_chain_end') {
            emitter.emit('end');
          }
        }

      } catch (error) {
        console.error("Erreur lors de la recherche dans les documents:", error);
        emitter.emit('error', JSON.stringify({
          type: 'error',
          data: error.message
        }));
      }

      return emitter;
    }
  }
};

export default MetaSearchAgent;

