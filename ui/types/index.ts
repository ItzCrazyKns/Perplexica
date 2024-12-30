export interface Expert {
  id: number;
  id_expert: string;
  nom: string;
  prenom: string;
  adresse: string;
  pays: string;
  ville: string;
  expertises: string;
  biographie: string;
  tarif: number;
  services: any;
  created_at: string;
  image_url: string;
  avatar_url?: string;
}

export interface Location {
  pays: string;
  villes: string[];
}

export interface Expertise {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  read: boolean;
} 