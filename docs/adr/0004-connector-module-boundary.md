# All Notion API access flows through one domain module

Every Notion API call goes through `src/lib/connectors/notion/`; the UI reaches it only via Vane server routes (`/api/notion/*`) and the agent only via thin `ResearchAction` adapters (`src/lib/agents/search/researcher/actions/notion/*`). The UI never calls the Notion API directly, and no generic Connector interface is defined until a second connector (Drive, GitHub, Slack, Linear) actually arrives. Keeps Notion calls from scattering across the agent and leaves room for future connectors without speculative abstraction.
