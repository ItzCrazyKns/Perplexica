import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  RunnableLambda,
  RunnableMap,
  RunnableSequence,
} from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseMessage } from '@langchain/core/messages';
import { supabase } from '../db/supabase';
import formatChatHistoryAsString from '../utils/formatHistory';
import { Expert, ExpertSearchRequest, ExpertSearchResponse } from '../types/types';

type ExpertSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

const ExpertSearchChainPrompt = `
Vous êtes un agent spécialisé dans l'analyse et la recherche d'experts professionnels. Votre rôle est d'interpréter les demandes des utilisateurs et d'extraire les informations essentielles pour trouver l'expert le plus pertinent.

OBJECTIF :
Analyser la requête pour identifier précisément :
1. Le domaine d'expertise recherché
2. La localisation souhaitée (si mentionnée)

RÈGLES D'EXTRACTION :
- Pour l'EXPERTISE :
  * Identifier le domaine principal (comptabilité, droit, marketing, etc.)
  * Reconnaître les spécialisations (droit des affaires, marketing digital, etc.)
  * Nettoyer les mots parasites (expert, spécialiste, professionnel, etc.)

- Pour la VILLE :
  * Si mentionnée
  * Extraire la ville mentionnée
  * Ignorer si non spécifiée
  * Standardiser le format (tout en minuscules)

FORMAT DE RÉPONSE STRICT :
Répondre en deux lignes exactement :
expertise: [domaine d'expertise]
ville: [ville si mentionnée]

EXEMPLES D'ANALYSE :

1. "Je cherche un expert comptable sur Paris"
expertise: comptabilité
ville: paris

2. "Il me faudrait un avocat spécialisé en droit des affaires à Lyon"
expertise: droit des affaires
ville: lyon

Conversation précédente :
{chat_history}

Requête actuelle : {query}

Principe de recherche d'expert :
- Pour toute recherche d'expert, extraire UNIQUEMENT :
  * L'expertise demandée
  * La ville (si mentionnée)

- Mots déclencheurs à reconnaître :
  * "cherche un expert/spécialiste/consultant"
  * "besoin d'un professionnel"
  * "recherche quelqu'un pour"
  * "qui peut m'aider avec"

<example>
\`<query>
Je cherche un expert comptable
</query>
expertise: comptabilité
ville: 
\`

\`<query>
J'ai besoin d'un spécialiste en droit des sociétés à Lyon
</query>
expertise: droit des sociétés
ville: lyon
\`

\`<query>
Qui peut m'aider avec ma comptabilité sur Paris ?
</query>
expertise: comptabilité
ville: paris
\`
</example>
`;

const ExpertAnalysisPrompt = `
Vous devez générer une synthèse des experts trouvés en vous basant UNIQUEMENT sur les données fournies.

Contexte de la recherche : {query}

Experts trouvés (à utiliser EXCLUSIVEMENT) :
{experts}

Format de la synthèse :
🎯 Synthèse de la recherche
[Résumé bref de la demande]

💫 Experts disponibles :
[Pour chaque expert trouvé dans les données :]
- [Prénom Nom] à [Ville]
  Expertise : [expertises]
  Tarif : [tarif]€
  [Point clé de la biographie]

⚠️ IMPORTANT : N'inventez PAS d'experts. Utilisez UNIQUEMENT les données fournies.
`;

const strParser = new StringOutputParser();

// Fonction pour convertir les données de l'expert
const convertToExpert = (data: any): Expert => {
  return {
    id: data.id,
    id_expert: data.id_expert || '',
    nom: data.nom,
    prenom: data.prenom,
    adresse: data.adresse || '',
    pays: data.pays,
    ville: data.ville,
    expertises: data.expertises,
    specialite: data.specialite || data.expertises?.[0] || '',
    biographie: data.biographie,
    tarif: data.tarif || 0,
    services: data.services,
    created_at: data.created_at,
    image_url: data.image_url
  };
};

const createExpertSearchChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: ExpertSearchChainInput) => {
        return formatChatHistoryAsString(input.chat_history || []);
      },
      query: (input: ExpertSearchChainInput) => {
        return input.query || '';
      },
    }),
    PromptTemplate.fromTemplate(ExpertSearchChainPrompt),
    llm,
    strParser,
    RunnableLambda.from(async (response: string) => {
      try {
        // Extraire expertise et ville avec gestion des erreurs
        const lines = response.split('\n').filter(line => line.trim() !== '');
        const expertise = lines[0]?.replace('expertise:', '')?.trim() || '';
        const ville = lines[1]?.replace('ville:', '')?.trim() || '';

        if (!expertise) {
          return {
            experts: [],
            synthese: "Je n'ai pas pu identifier l'expertise recherchée."
          } as ExpertSearchResponse;
        }

        // Rechercher les experts
        let query = supabase
          .from('experts')
          .select('*')
          .ilike('expertises', `%${expertise}%`)
          .limit(3);

        if (ville) {
          query = query.ilike('ville', `%${ville}%`);
        }

        const { data: experts, error } = await query;

        if (error) throw error;

        if (!experts || experts.length === 0) {
          return {
            experts: [],
            synthese: "Désolé, je n'ai pas trouvé d'experts correspondant à vos critères."
          } as ExpertSearchResponse;
        }

        const synthesePrompt = PromptTemplate.fromTemplate(ExpertAnalysisPrompt);
        const formattedPrompt = await synthesePrompt.format({
          query: response,
          experts: JSON.stringify(experts, null, 2)
        });

        const syntheseResponse = await llm.invoke(formattedPrompt);
        const syntheseString = typeof syntheseResponse.content === 'string' 
          ? syntheseResponse.content 
          : JSON.stringify(syntheseResponse.content);

        return {
          experts: experts.map(convertToExpert),
          synthese: syntheseString
        } as ExpertSearchResponse;

      } catch (error) {
        console.error('❌ Erreur:', error);
        return {
          experts: [],
          synthese: "Une erreur est survenue lors de la recherche d'experts."
        } as ExpertSearchResponse;
      }
    }),
  ]);
};

const handleExpertSearch = async (input: ExpertSearchRequest, llm: BaseChatModel) => {
  try {
    // 1. Analyse de la requête via LLM pour extraire l'expertise et la ville
    const expertSearchChain = createExpertSearchChain(llm);
    const result = await expertSearchChain.invoke({
      query: input.query,
      chat_history: input.chat_history || []
    }) as ExpertSearchResponse; // Le résultat est déjà une ExpertSearchResponse

    // Pas besoin de retraiter la réponse car createExpertSearchChain fait déjà tout le travail
    return result;

  } catch (error) {
    console.error('❌ Erreur dans handleExpertSearch:', error);
    return {
      experts: [],
      synthese: "Une erreur est survenue."
    };
  }
};

export default handleExpertSearch;