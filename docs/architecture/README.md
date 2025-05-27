# Perplexica's Architecture

Perplexica's architecture consists of the following key components:

1. **User Interface**: A web-based interface that allows users to interact with Perplexica for searching images, videos, and much more.
2. **Agent/Chains**: These components predict Perplexica's next actions, understand user queries, and decide whether a web search is necessary.
3. **SearXNG**: A metadata search engine used by Perplexica to search the web for sources.
4. **LLMs (Large Language Models)**: Utilized by agents and chains for tasks like understanding content, writing responses, and citing sources. Examples include Claude, GPTs, etc.
5. **Embedding Models**: To improve the accuracy of search results, embedding models re-rank the results using similarity search algorithms such as cosine similarity and dot product distance.
6. **Web Content**
   - In Quality mode the application uses Crawlee, Playwright, and Chromium to load web content into a real full browser
      - This significantly increases the size of the docker image and also means it can only run on x64 architectures
      - The docker build has been updated to restrict images to linux/amd64 architecture
   - In Balanced mode, the application uses JSDoc and Mozilla's Readability to retrieve and rank relevant segments of web content
      - This approach is less successful than Quality as it doesn't use a full web browser and can't load dynamic content
      - It is also more prone to being blocked by ads or scraping detection
      - Because it only uses segments of web content, it can be less accurate than Quality mode
   - In Speed mode, the application only uses the preview content returned by SearXNG
      - This content is provided by the search engines and contains minimal context from the actual web page
      - This mode is the least accurate and is often prone to hallucination

For a more detailed explanation of how these components work together, see [WORKING.md](https://github.com/ItzCrazyKns/Perplexica/tree/master/docs/architecture/WORKING.md).
