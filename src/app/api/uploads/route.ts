import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAvailableEmbeddingModelProviders, getAvailableChatModelProviders } from '@/lib/providers';
import { 
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from 'langchain/document';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';
import { withStructuredOutput } from '@/lib/utils/structuredOutput';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';

interface FileRes {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

// Define Zod schema for structured topic generation output
const TopicsSchema = z.object({
  topics: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe('Array of 1-3 concise, descriptive topics that capture the main subject matter'),
});

type TopicsOutput = z.infer<typeof TopicsSchema>;

/**
 * Generate semantic topics for a document using LLM with structured output
 */
async function generateFileTopics(
  content: string,
  filename: string,
  llm: BaseChatModel
): Promise<string> {
  try {
    // Take first 1500 characters for topic generation to avoid token limits
    const excerpt = content.substring(0, 1500);
    
    const prompt = `Analyze the following document excerpt and generate 1-5 concise, descriptive topics that capture the main subject matter. The topics should be useful for determining if this document is relevant to answer questions.

Document filename: ${filename}
Document excerpt:
${excerpt}

Generate topics that describe what this document is about, its domain, and key subject areas. Focus on topics that would help determine relevance for search queries.`;

    // Use structured output for reliable topic extraction
    const structuredLlm = withStructuredOutput(llm, TopicsSchema, {
      name: 'generate_topics',
    });

    const result = await structuredLlm.invoke(prompt, {
      ...getLangfuseCallbacks(),
    });
    console.log('Generated topics:', result.topics);
    // Filename is included for context
    return filename + ', ' + result.topics.join(', ');
  } catch (error) {
    console.warn('Error generating topics with LLM:', error);
    return `Document: ${filename}`;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const files = formData.getAll('files') as File[];
    const embedding_model = formData.get('embedding_model');
    const embedding_model_provider = formData.get('embedding_model_provider');
    const chat_model = formData.get('chat_model');
    const chat_model_provider = formData.get('chat_model_provider');
    const ollama_context_window = formData.get('ollama_context_window');

    if (!embedding_model || !embedding_model_provider) {
      return NextResponse.json(
        { message: 'Missing embedding model or provider' },
        { status: 400 },
      );
    }

    // Get available providers
    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    // Setup embedding model
    const embeddingProvider =
      embeddingModelProviders[
        embedding_model_provider as string ?? Object.keys(embeddingModelProviders)[0]
      ];
    const embeddingModelConfig =
      embeddingProvider[
        embedding_model as string ?? Object.keys(embeddingProvider)[0]
      ];

    if (!embeddingModelConfig) {
      return NextResponse.json(
        { message: 'Invalid embedding model selected' },
        { status: 400 },
      );
    }

    let embeddingsModel = embeddingModelConfig.model;

    // Setup chat model for topic generation (similar to chat route)
    const chatModelProvider =
      chatModelProviders[
        chat_model_provider as string ?? Object.keys(chatModelProviders)[0]
      ];
    const chatModelConfig =
      chatModelProvider[
        chat_model as string ?? Object.keys(chatModelProvider)[0]
      ];

    let llm: BaseChatModel;

    // Handle chat model creation like in chat route
    if (chat_model_provider === 'custom_openai') {
      llm = new ChatOpenAI({
        openAIApiKey: getCustomOpenaiApiKey(),
        modelName: getCustomOpenaiModelName(),
        temperature: 0.1,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (chatModelProvider && chatModelConfig) {
      llm = chatModelConfig.model;

      // Set context window size for Ollama models
      if (llm instanceof ChatOllama && chat_model_provider === 'ollama') {
        // Use provided context window or default to 2048
        const contextWindow = ollama_context_window ? 
          parseInt(ollama_context_window as string, 10) : 2048;
        llm.numCtx = contextWindow;
      }
    }

    const processedFiles: FileRes[] = [];

    await Promise.all(
      files.map(async (file: any) => {
        const fileExtension = file.name.split('.').pop();
        if (!['pdf', 'docx', 'txt'].includes(fileExtension!)) {
          return NextResponse.json(
            { message: 'File type not supported' },
            { status: 400 },
          );
        }

        const uniqueFileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
        const filePath = path.join(uploadDir, uniqueFileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, new Uint8Array(buffer));

        let docs: any[] = [];
        if (fileExtension === 'pdf') {
          const loader = new PDFLoader(filePath);
          docs = await loader.load();
        } else if (fileExtension === 'docx') {
          const loader = new DocxLoader(filePath);
          docs = await loader.load();
        } else if (fileExtension === 'txt') {
          const text = fs.readFileSync(filePath, 'utf-8');
          docs = [
            new Document({ pageContent: text, metadata: { title: file.name } }),
          ];
        }

        const splitted = await splitter.splitDocuments(docs);

        // Generate semantic topics using LLM
        const fullContent = docs.map(doc => doc.pageContent).join('\n');
        const semanticTopics = await generateFileTopics(fullContent, file.name, llm);

        const extractedDataPath = filePath.replace(/\.\w+$/, '-extracted.json');
        fs.writeFileSync(
          extractedDataPath,
          JSON.stringify({
            title: file.name,
            topics: semanticTopics,
            contents: splitted.map((doc) => doc.pageContent),
          }),
        );

        const embeddings = await embeddingsModel.embedDocuments(
          splitted.map((doc) => doc.pageContent),
        );
        const embeddingsDataPath = filePath.replace(
          /\.\w+$/,
          '-embeddings.json',
        );
        fs.writeFileSync(
          embeddingsDataPath,
          JSON.stringify({
            title: file.name,
            embeddings,
          }),
        );

        processedFiles.push({
          fileName: file.name,
          fileExtension: fileExtension,
          fileId: uniqueFileName.replace(/\.\w+$/, ''),
        });
      }),
    );

    return NextResponse.json({
      files: processedFiles,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
}
