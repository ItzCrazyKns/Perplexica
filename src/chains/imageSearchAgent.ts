import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { searchSearxng } from '../lib/searxng';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

const imageSearchChainPrompt = `
Vous êtes un expert en recherche d'images pour illustrer des contenus business. Votre objectif est de trouver des images élégantes et modernes qui illustrent le sujet de manière indirecte et esthétique.

Principes à suivre :
- Privilégier des images lifestyle et esthétiques
- Éviter les schémas, graphiques et images trop techniques
- Favoriser des images avec des personnes dans des situations naturelles
- Choisir des images lumineuses et positives
- Préférer des compositions simples et épurées

Format de la requête :
- 2-3 mots-clés maximum
- Ajouter "lifestyle" ou "modern" pour améliorer la qualité
- Toujours ajouter "professional" pour le contexte business

Exemples :
1. Question : "Comment créer une entreprise ?"
Requête : "entrepreneur lifestyle modern"

2. Question : "Qu'est-ce qu'un business plan ?"
Requête : "business meeting professional"

3. Question : "Comment faire sa comptabilité ?"
Requête : "office work lifestyle"

Conversation :
{chat_history}

Question : {query}
Requête de recherche d'image :`;

type ImageSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

const strParser = new StringOutputParser();

const createImageSearchChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: ImageSearchChainInput) => {
        return formatChatHistoryAsString(input.chat_history);
      },
      query: (input: ImageSearchChainInput) => {
        return input.query;
      },
    }),
    PromptTemplate.fromTemplate(imageSearchChainPrompt),
    llm,
    strParser,
    RunnableLambda.from(async (input: string) => {
      const res = await searchSearxng(input, {
        engines: ['google_images', 'bing_images'],
        language: 'fr',
        categories: ['images'],
      });
      
      const images = [];
      res.results.forEach((result) => {
        if (result.img_src && result.url && result.title) {
          images.push({
            img_src: result.img_src,
            url: result.url,
            title: result.title,
          });
        }
      });
      
      return images.slice(0, 10);
    }),
  ]);
};

const handleImageSearch = (
  input: ImageSearchChainInput,
  llm: BaseChatModel,
) => {
  const imageSearchChain = createImageSearchChain(llm);
  return imageSearchChain.invoke(input);
};

export default handleImageSearch;