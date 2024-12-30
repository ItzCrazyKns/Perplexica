import { BaseMessage } from '@langchain/core/messages';

export interface Expert {
  id: number;
  id_expert: string;
  nom: string;
  prenom: string;
  adresse: string;
  pays: string;
  ville: string;
  expertises: string;
  specialite: string;
  biographie: string;
  tarif: number;
  services: any;
  created_at: string;
  image_url: string;
}

export interface ExpertSearchRequest {
  query: string;
  chat_history: BaseMessage[];
  messageId: string;
  chatId: string;
}

export interface ExpertSearchResponse {
  experts: Expert[];
  synthese: string;
}

export interface EnrichedResponse {
  text: string;
  sources: Source[];
  suggestions: string[];
  images: ImageResult[];
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface ImageResult {
  url: string;
  title: string;
  source: string;
}

export interface DocumentMetadata {
  title?: string;
  source?: string;
  type?: string;
  url?: string;
  pageNumber?: number;
  score?: number;
  expertData?: any;
  searchText?: string;
  illustrationImage?: string;
  imageTitle?: string;
  [key: string]: any;
}

export interface NormalizedSource {
  pageContent: string;
  metadata: DocumentMetadata;
}

export interface SearchResult {
  pageContent: string;
  metadata: DocumentMetadata;
}