# Perplexica's Architecture

Perplexica's architecture consists of the following key components:

1. **User Interface**: A web-based interface that allows users to interact with Perplexica for searching images, videos, and much more.
2. **Agent/Chains**: These components predict Perplexica's next actions, understand user queries, and decide whether a web search is necessary.
3. **SearXNG**: A metadata search engine used by Perplexica to search the web for sources.
4. **LLMs (Large Language Models)**: Utilized by agents and chains for tasks like understanding content, writing responses, and citing sources. Examples include Claude, GPTs, etc.
5. **Embedding Models**: To improve the accuracy of search results, embedding models re-rank the results using similarity search algorithms such as cosine similarity and dot product distance.
6. **Web Content**
   - In Agent mode, the application uses an agentic workflow to answer complex multi-part questions
     - The agent can use reasoning steps to provide comprehensive answers to complex questions
     - Agent mode is experimental and may consume lots of tokens and take a long time to produce responses
   - In Speed mode, the application only uses the preview content returned by SearXNG
     - This content is provided by the search engines and contains minimal context from the actual web page
     - This mode prioritizes quick responses over accuracy

For a more detailed explanation of how these components work together, see [WORKING.md](https://github.com/ItzCrazyKns/Perplexica/tree/master/docs/architecture/WORKING.md).
