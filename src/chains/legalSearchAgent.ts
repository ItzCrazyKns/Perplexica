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
  
  const legalSearchChainPrompt = `
    Vous êtes un assistant juridique expert spécialisé dans la recherche documentaire légale française. Votre rôle est d'analyser la question de l'utilisateur et de générer une requête de recherche optimisée.
  
  Contexte de la conversation :
  {chat_history}
  
  Question actuelle : {query}
  
  Instructions détaillées :
  1. Analysez précisément :
     - Le domaine juridique spécifique (droit du travail, droit des sociétés, etc.)
     - Le type de document recherché (loi, décret, jurisprudence, etc.)
     - Les points clés de la problématique
  
  2. Construisez une requête qui inclut :
     - Les termes juridiques exacts (articles de code, références légales)
     - Les mots-clés techniques appropriés
     - Les synonymes pertinents
     - La période temporelle si pertinente (loi récente, modifications)
  
  3. Priorisez les sources selon la hiérarchie :
     - Codes et lois : Légifrance
     - Information officielle : Service-public.fr
     - Publications : Journal-officiel
     - Informations pratiques : URSSAF, CCI
  
  Exemples de reformulation :
  Question : "Comment créer une SARL ?"
  → "Code commerce SARL constitution statuts gérance responsabilité associés capital social formalités légifrance service-public"
  
  Question : "Licenciement économique procédure"
  → "Code travail licenciement économique procédure CSE PSE motif notification délais recours légifrance"
  
  Question : "Bail commercial résiliation"
  → "Code commerce bail commercial résiliation article L145-4 congé indemnité éviction légifrance jurisprudence"
  
  Reformulez la question de manière précise et technique :`;
  
  type LegalSearchChainInput = {
    chat_history: BaseMessage[];
    query: string;
  };
  
  const strParser = new StringOutputParser();
  
  const createLegalSearchChain = (llm: BaseChatModel) => {
    return RunnableSequence.from([
      RunnableMap.from({
        chat_history: (input: LegalSearchChainInput) => {
          return formatChatHistoryAsString(input.chat_history);
        },
        query: (input: LegalSearchChainInput) => {
          return input.query;
        },
      }),
      PromptTemplate.fromTemplate(legalSearchChainPrompt),
      llm,
      strParser,
      RunnableLambda.from(async (input: string) => {
        const pdfQuery = `${input} filetype:pdf`;
        
        const res = await searchSearxng(pdfQuery, {
          engines: [
            'legifrance',
            'journal_officiel',
            'service_public',
            'URSSAF',
            'CCI'
          ],
          language: 'fr',
          categories: ['general', 'files']
        });
  
        const documents = [];
  
        res.results.forEach((result) => {
          if (result.url && result.title) {
            documents.push({
              url: result.url,
              title: result.title,
              snippet: result.content || '',
              source: result.url.split('/')[2] || 'unknown',
              type: 'pdf'
            });
          }
        });
  
        return documents.slice(0, 10);
      }),
    ]);
  };
  
  const handleLegalSearch = (
    input: LegalSearchChainInput,
    llm: BaseChatModel,
  ) => {
    const legalSearchChain = createLegalSearchChain(llm);
    return legalSearchChain.invoke(input);
  };
  
  export default handleLegalSearch; 