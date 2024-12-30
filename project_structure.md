# Structure du Projet X-me

```
X-me/
├── .assets/
├── .dockerignore
├── .git/
├── .github/
├── .gitignore
├── .prettierignore
├── .prettierrc.js
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── app.dockerfile
├── backend.dockerfile
├── config.toml
├── data/
├── docker-compose.yaml
├── docs/
├── drizzle.config.ts
├── package.json
├── project_structure.md
├── searxng/
│   ├── limiter.toml
│   ├── settings.yml
│   └── uwsgi.ini
├── src/
│   ├── app.ts
│   ├── config.ts
│   ├── chains/
│   │   ├── expertSearchAgent.ts
│   │   ├── imageSearchAgent.ts
│   │   ├── legalSearchAgent.ts
│   │   ├── suggestionGeneratorAgent.ts
│   │   └── videoSearchAgent.ts
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── supabase.ts
│   ├── lib/
│   │   ├── huggingfaceTransformer.ts
│   │   ├── outputParsers/
│   │   │   ├── lineOutputParser.ts
│   │   │   └── listLineOutputParser.ts
│   │   ├── providers/
│   │   │   ├── anthropic.ts
│   │   │   ├── gemini.ts
│   │   │   ├── groq.ts
│   │   │   ├── index.ts
│   │   │   ├── ollama.ts
│   │   │   ├── openai.ts
│   │   │   └── transformers.ts
│   │   └── searxng.ts
│   ├── prompts/
│   │   ├── academicSearch.ts
│   │   ├── index.ts
│   │   ├── redditSearch.ts
│   │   ├── webSearch.ts
│   │   ├── wolframAlpha.ts
│   │   ├── writingAssistant.ts
│   │   └── youtubeSearch.ts
│   ├── routes/
│   │   ├── chats.ts
│   │   ├── config.ts
│   │   ├── discover.ts
│   │   ├── images.ts
│   │   ├── index.ts
│   │   ├── legal.ts
│   │   ├── models.ts
│   │   ├── search.ts
│   │   ├── suggestions.ts
│   │   ├── uploads.ts
│   │   └── videos.ts
│   ├── search/
│   │   └── metaSearchAgent.ts
│   ├── utils/
│   │   ├── computeSimilarity.ts
│   │   ├── documents.ts
│   │   ├── files.ts
│   │   ├── formatHistory.ts
│   │   └── logger.ts
│   └── websocket/
│       ├── connectionManager.ts
│       ├── index.ts
│       ├── messageHandler.ts
│       └── websocketServer.ts
├── tsconfig.json
├── ui/
│   ├── .env.example
│   ├── .eslintrc.json
│   ├── .gitignore
│   ├── .prettierrc.js
│   ├── app/
│   │   ├── c/
│   │   │   └── [chatId]/
│   │   │       └── page.tsx
│   │   ├── chatroom/
│   │   │   └── page.tsx
│   │   ├── discover/
│   │   │   └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── library/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   └── input.tsx
│   │   ├── Chat.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── DeleteChat.tsx
│   │   ├── EmptyChat.tsx
│   │   ├── EmptyChatMessageInput.tsx
│   │   ├── Layout.tsx
│   │   ├── LegalSearch.tsx
│   │   ├── MessageBox.tsx
│   │   ├── MessageBoxLoading.tsx
│   │   ├── MessageInput.tsx
│   │   ├── MessageSources.tsx
│   │   ├── MessageActions/
│   │   │   ├── Copy.tsx
│   │   │   └── Rewrite.tsx
│   │   ├── MessageInputActions/
│   │   │   ├── Attach.tsx
│   │   │   ├── AttachSmall.tsx
│   │   │   ├── Copilot.tsx
│   │   │   ├── Focus.tsx
│   │   │   └── Optimization.tsx
│   │   ├── Navbar.tsx
│   │   ├── SearchImages.tsx
│   │   ├── SearchVideos.tsx
│   │   ├── SettingsDialog.tsx
│   │   ├── Sidebar.tsx
│   │   └── theme/
│   │       ├── Provider.tsx
│   │       └── Switcher.tsx
│   ├── lib/
│   │   ├── actions.ts
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── next.config.mjs
│   ├── package.json
│   ├── postcss.config.js
│   ├── public/
│   │   ├── next.svg
│   │   └── vercel.svg
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── yarn.lock
├── uploads/
└── yarn.lock

Cette arborescence représente la structure complète du projet X-me, incluant tous les fichiers et dossiers.
