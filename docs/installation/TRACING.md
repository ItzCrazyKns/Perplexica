# Tracing LLM Calls in Perplexica

Perplexica supports tracing all LangChain and LangGraph LLM calls for debugging, analytics, and prompt transparency. You can use either Langfuse (self-hosted, private, or cloud) or LangSmith (cloud, by LangChain) for tracing.

## Langfuse Tracing (Recommended for Private/Self-Hosted)

Langfuse is an open-source, self-hostable observability platform for LLM applications. It allows you to trace prompts, completions, and tool calls **privately**—no data leaves your infrastructure if you self-host.

### Setup

1. **Deploy Langfuse**
   - See: [Langfuse Self-Hosting Guide](https://langfuse.com/docs/self-hosting)
   - You can also use the Langfuse Cloud if you prefer.

2. **Configure Environment Variables**
   - Add the following to your environment variables in docker-compose or your deployment environment:

     ```env
     LANGFUSE_PUBLIC_KEY=your-public-key
     LANGFUSE_SECRET_KEY=your-secret-key
     LANGFUSE_BASE_URL=https://your-langfuse-instance.com
     ```

   - These are required for the tracing integration to work. If not set, tracing is disabled gracefully.

3. **Run Perplexica**
   - All LLM and agent calls will be traced automatically. You can view traces in your Langfuse dashboard.

## LangSmith Tracing (Cloud by LangChain)

Perplexica also supports tracing via [LangSmith](https://smith.langchain.com/), the official observability platform by LangChain.

- To enable LangSmith, follow the official guide: [LangSmith Observability Docs](https://docs.smith.langchain.com/observability)
- Set the required environment variables as described in their documentation.

**LangSmith is a managed cloud service.**

---

For more details on tracing, see the respective documentation:

- [Langfuse Documentation](https://langfuse.com/docs)
- [LangSmith Observability](https://docs.smith.langchain.com/observability)
