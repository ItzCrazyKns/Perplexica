# Vane 🔍

[![GitHub Repo stars](https://img.shields.io/github/stars/ItzCrazyKns/Vane?style=social)](https://github.com/ItzCrazyKns/Vane/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ItzCrazyKns/Vane?style=social)](https://github.com/ItzCrazyKns/Vane/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/ItzCrazyKns/Vane?style=social)](https://github.com/ItzCrazyKns/Vane/watchers)
[![Docker Pulls](https://img.shields.io/docker/pulls/penny13692018/vane?color=blue)](https://hub.docker.com/r/penny13692018/vane)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/ItzCrazyKns/Vane/blob/master/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/ItzCrazyKns/Vane?color=green)](https://github.com/ItzCrazyKns/Vane/commits/master)
[![Discord](https://dcbadge.limes.pink/api/server/26aArMy8tT?style=flat)](https://discord.gg/26aArMy8tT)

Vane is a **privacy-focused AI answering engine** that runs entirely on your own hardware. It combines knowledge from the vast internet with support for **local LLMs** (Ollama) and cloud providers (OpenAI, Claude, Groq), delivering accurate answers with **cited sources** while keeping your searches completely private.

![preview](.assets/vane-screenshot.png)

Want to know more about its architecture and how it works? You can read it [here](https://github.com/ItzCrazyKns/Vane/tree/master/docs/architecture/README.md).

## ✨ Features

🤖 **Support for all major AI providers** - Use local LLMs through Ollama or connect to OpenAI, Anthropic Claude, Google Gemini, Groq, and more. Mix and match models based on your needs.

⚡ **Smart search modes** - Choose Speed Mode when you need quick answers, Balanced Mode for everyday searches, or Quality Mode for deep research.

🧭 **Pick your sources** - Search the web, discussions, or academic papers. More sources and integrations are in progress.

🧩 **Widgets** - Helpful UI cards that show up when relevant, like weather, calculations, stock prices, and other quick lookups.

🔍 **Web search powered by SearxNG** - Access multiple search engines while keeping your identity private. Support for Tavily and Exa coming soon for even better results.

📷 **Image and video search** - Find visual content alongside text results. Search isn't limited to just articles anymore.

📄 **File uploads** - Upload documents and ask questions about them. PDFs, text files, images - Vane understands them all.

🗂️ **Notion connector** - Connect your Notion workspace and reference your own pages in any conversation with `@Notion 頁面名` or the page picker. Read page content and query databases through OAuth — per-conversation, never global.

🌐 **Search specific domains** - Limit your search to specific websites when you know where to look. Perfect for technical documentation or research papers.

💡 **Smart suggestions** - Get intelligent search suggestions as you type, helping you formulate better queries.

📚 **Discover** - Browse interesting articles and trending content throughout the day. Stay informed without even searching.

🕒 **Search history** - Every search is saved locally so you can revisit your discoveries anytime. Your research is never lost.

✨ **More coming soon** - We're actively developing new features based on community feedback. Join our Discord to help shape Vane's future!

## Sponsors

Vane's development is powered by the generous support of our sponsors. Their contributions help keep this project free, open-source, and accessible to everyone.

We'd like to thank the following partners for their generous support:

<table>
  <tr>
    <td width="100" align="center">
      <a href="https://dashboard.exa.ai" target="_blank">
        <img src=".assets/sponsers/exa.png" alt="Exa" width="80" height="80" style="border-radius: .75rem;" />
      </a>
    </td>
    <td>
      <a href="https://dashboard.exa.ai">Exa</a> • The Perfect Web Search API for LLMs - web search, crawling, deep research, and answer APIs
    </td>
  </tr>
</table>

## Installation

There are mainly 2 ways of installing Vane - With Docker, Without Docker. Using Docker is highly recommended.

### Getting Started with Docker (Recommended)

Vane can be easily run using Docker. Simply run the following command:

```bash
docker run -d -p 3000:3000 -v vane-data:/home/vane/data --name vane penny13692018/vane:latest
```

This will pull and start the Vane container with the bundled SearxNG search engine. Once running, open your browser and navigate to http://localhost:3000. You can then configure your settings (API keys, models, etc.) directly in the setup screen.

**Note**: The image includes both Vane and SearxNG, so no additional setup is required — no `SEARXNG_API_URL` needed (SearxNG listens on `localhost:8080` inside the container). The `-v` flags create persistent volumes for your data and uploaded files.

**With the Notion connector** — to use `@Notion 頁面名`, run with your integration credentials (replace the `YOUR_NOTION_*` values; see the [Notion Connector](#-notion-connector) section below for how to create the integration and choose the encryption key):

```bash
docker run -d -p 3000:3000 -e NOTION_CLIENT_ID=YOUR_NOTION_CLIENT_ID -e NOTION_CLIENT_SECRET=YOUR_NOTION_CLIENT_SECRET -e NOTION_TOKEN_KEY=YOUR_NOTION_TOKEN_KEY -v vane-data:/home/vane/data --name vane penny13692018/vane:latest
```

#### Using Vane with Your Own SearxNG Instance

If you already have SearxNG running, you can use the slim version of Vane:

```bash
docker run -d -p 3000:3000 -e SEARXNG_API_URL=http://your-searxng-url:8080 -v vane-data:/home/vane/data --name vane penny13692018/vane:slim-latest
```

**Important**: Make sure your SearxNG instance has:

- JSON format enabled in the settings
- Wolfram Alpha search engine enabled

Replace `http://your-searxng-url:8080` with your actual SearxNG URL. Then configure your AI provider settings in the setup screen at http://localhost:3000.

#### Advanced Setup (Building from Source)

If you prefer to build from source or need more control:

1. Ensure Docker is installed and running on your system.
2. Clone the Vane repository:

   ```bash
   git clone https://github.com/ItzCrazyKns/Vane.git
   ```

3. After cloning, navigate to the directory containing the project files.

4. Build and run using Docker:

   ```bash
   docker build -t vane .
   docker run -d -p 3000:3000 -v vane-data:/home/vane/data --name vane vane
   ```

5. Access Vane at http://localhost:3000 and configure your settings in the setup screen.

**Note**: After the containers are built, you can start Vane directly from Docker without having to open a terminal.

### Non-Docker Installation

1. Install SearXNG and allow `JSON` format in the SearXNG settings. Make sure Wolfram Alpha search engine is also enabled.
2. Clone the repository:

   ```bash
   git clone https://github.com/ItzCrazyKns/Vane.git
   cd Vane
   ```

3. Install dependencies:

   ```bash
   npm i
   ```

4. Build the application:

   ```bash
   npm run build
   ```

5. Start the application:

   ```bash
   npm run start
   ```

6. Open your browser and navigate to http://localhost:3000 to complete the setup and configure your settings (API keys, models, SearxNG URL, etc.) in the setup screen.

**Note**: Using Docker is recommended as it simplifies the setup process, especially for managing environment variables and dependencies.

See the [installation documentation](https://github.com/ItzCrazyKns/Vane/tree/master/docs/installation) for more information like updating, etc.

### Troubleshooting

#### Local OpenAI-API-Compliant Servers

If Vane tells you that you haven't configured any chat model providers, ensure that:

1. Your server is running on `0.0.0.0` (not `127.0.0.1`) and on the same port you put in the API URL.
2. You have specified the correct model name loaded by your local LLM server.
3. You have specified the correct API key, or if one is not defined, you have put _something_ in the API key field and not left it empty.

#### Ollama Connection Errors

If you're encountering an Ollama connection error, it is likely due to the backend being unable to connect to Ollama's API. To fix this issue you can:

1. **Check your Ollama API URL:** Ensure that the API URL is correctly set in the settings menu.
2. **Update API URL Based on OS:**
   - **Windows:** Use `http://host.docker.internal:11434`
   - **Mac:** Use `http://host.docker.internal:11434`
   - **Linux:** Use `http://<private_ip_of_host>:11434`

   Adjust the port number if you're using a different one.

3. **Linux Users - Expose Ollama to Network:**
   - Inside `/etc/systemd/system/ollama.service`, you need to add `Environment="OLLAMA_HOST=0.0.0.0:11434"`. (Change the port number if you are using a different one.) Then reload the systemd manager configuration with `systemctl daemon-reload`, and restart Ollama by `systemctl restart ollama`. For more information see [Ollama docs](https://github.com/ollama/ollama/blob/main/docs/faq.md#setting-environment-variables-on-linux)

   - Ensure that the port (default is 11434) is not blocked by your firewall.

#### Lemonade Connection Errors

If you're encountering a Lemonade connection error, it is likely due to the backend being unable to connect to Lemonade's API. To fix this issue you can:

1. **Check your Lemonade API URL:** Ensure that the API URL is correctly set in the settings menu.
2. **Update API URL Based on OS:**
   - **Windows:** Use `http://host.docker.internal:8000`
   - **Mac:** Use `http://host.docker.internal:8000`
   - **Linux:** Use `http://<private_ip_of_host>:8000`

   Adjust the port number if you're using a different one.

3. **Ensure Lemonade Server is Running:**
   - Make sure your Lemonade server is running and accessible on the configured port (default is 8000).
   - Verify that Lemonade is configured to accept connections from all interfaces (`0.0.0.0`), not just localhost (`127.0.0.1`).
   - Ensure that the port (default is 8000) is not blocked by your firewall.

## 🗂️ Notion Connector

Connect your Notion workspace and ask questions about your own pages — Perplexity-style. Reference a page in any conversation with `@Notion 頁面名` or pick one from the page selector, and Vane reads it through your Notion connection.

> **Current status:** read support — `notion_search`, `notion_get_page`, `notion_query_database`. Writing to Notion (create / update / append with a batched confirmation card) ships in a follow-up PR.

### How it works

- **OAuth, not tokens in .env** — you authorize via Notion's OAuth flow and the access token is encrypted at rest (AES-256-GCM, keyed by `NOTION_TOKEN_KEY`). No `NOTION_TOKEN=secret_xxx` anywhere.
- **Per-conversation scope** — Notion is never enabled globally. Each conversation chooses which authorized pages to use; if you don't `@Notion`, Vane won't ask about it.
- **Authorized pages only** — the connection requests only read / insert / update content capabilities, and only the pages you share with the integration can be searched.

### 1. Create a Notion integration

1. Go to [developers.notion.so](https://developers.notion.so) → **My integrations** → **New integration**.
2. Choose **Public integration** (OAuth) and give it a name.
3. Under **Capabilities**, check:
   - ☑ Read content
   - ☑ Insert content
   - ☑ Update content
   - Leave read/insert comments and user information unchecked.
4. In **Redirect URIs**, add:

   ```
   http://localhost:3000/api/notion/callback
   ```

   (replace the host/port with your Vane URL if Vane is not on localhost)

5. Copy the **OAuth client ID** and **OAuth client secret**.

### 2. Set environment variables

```bash
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret
NOTION_TOKEN_KEY=a_long_random_secret_for_encrypting_tokens
# Optional: override the OAuth callback URL when running behind Docker
# port-mapping or a reverse proxy, where the app cannot detect the
# browser-facing address (must match the redirect URI registered in the
# Notion integration exactly):
# NOTION_REDIRECT_URI=http://localhost:3100/api/notion/callback
```

`NOTION_TOKEN_KEY` encrypts the OAuth token at rest — use a long random string and keep it stable across restarts, otherwise the stored token can no longer be decrypted.

### 3. Connect in Settings

1. Open Vane → **Settings** → **Notion**.
2. Click **Connect** — you'll be taken to Notion to authorize and choose which pages to share.
3. When you return, Vane shows your workspace name and the connection is ready.

### 4. Use @Notion in a conversation

- Type `@Notion 頁面名` in a message, or open the Notion picker next to the input and select pages/databases.
- Selected pages appear as chips in the chat — they apply to that conversation only.
- Vane fuzzy-matches the name you typed against your pages; if nothing matches, it lists candidates and asks you to confirm — it never silently reads a different page.
- No connection yet? Vane shows a one-time hint and won't ask again.

### Troubleshooting

| Symptom                            | Fix                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Connect button disabled            | `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` not set                                        |
| "Stored token cannot be decrypted" | `NOTION_TOKEN_KEY` changed — disconnect and reconnect                                      |
| Pages don't show up                | Share the pages with your integration (integration Settings → Connections), then reconnect |

## Using as a Search Engine

If you wish to use Vane as an alternative to traditional search engines like Google or Bing, or if you want to add a shortcut for quick access from your browser's search bar, follow these steps:

1. Open your browser's settings.
2. Navigate to the 'Search Engines' section.
3. Add a new site search with the following URL: `http://localhost:3000/?q=%s`. Replace `localhost` with your IP address or domain name, and `3000` with the port number if Vane is not hosted locally.
4. Click the add button. Now, you can use Vane directly from your browser's search bar.

## Using Vane's API

Vane also provides an API for developers looking to integrate its powerful search engine into their own applications. You can run searches, use multiple models and get answers to your queries.

For more details, check out the full documentation [here](https://github.com/ItzCrazyKns/Vane/tree/master/docs/API/SEARCH.md).

## Expose Vane to network

Vane runs on Next.js and handles all API requests. It works right away on the same network and stays accessible even with port forwarding.

## One-Click Deployment

[![Deploy to Sealos](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://usw.sealos.io/?openapp=system-template%3FtemplateName%3Dperplexica)
[![Deploy to RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploylobe.svg)](https://repocloud.io/details/?app_id=267)
[![Run on ClawCloud](https://raw.githubusercontent.com/ClawCloud/Run-Template/refs/heads/main/Run-on-ClawCloud.svg)](https://template.run.claw.cloud/?referralCode=U11MRQ8U9RM4&openapp=system-fastdeploy%3FtemplateName%3Dperplexica)
[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/vps/docker-hosting?compose_url=https://raw.githubusercontent.com/ItzCrazyKns/Vane/refs/heads/master/docker-compose.yaml)

## Upcoming Features

- [ ] Adding more widgets, integrations, search sources
- [ ] Adding ability to create custom agents (name T.B.D.)
- [ ] Adding authentication

## Support Us

If you find Vane useful, consider giving us a star on GitHub. This helps more people discover Vane and supports the development of new features. Your support is greatly appreciated.

### Donations

We also accept donations to help sustain our project. If you would like to contribute, you can use the following options to donate. Thank you for your support!

| Ethereum                                              |
| ----------------------------------------------------- |
| Address: `0xB025a84b2F269570Eb8D4b05DEdaA41D8525B6DD` |

## Contribution

Vane is built on the idea that AI and large language models should be easy for everyone to use. If you find bugs or have ideas, please share them in via GitHub Issues. For more information on contributing to Vane you can read the [CONTRIBUTING.md](CONTRIBUTING.md) file to learn more about Vane and how you can contribute to it.

## Help and Support

If you have any questions or feedback, please feel free to reach out to us. You can create an issue on GitHub or join our Discord server. There, you can connect with other users, share your experiences and reviews, and receive more personalized help. [Click here](https://discord.gg/EFwsmQDgAu) to join the Discord server. To discuss matters outside of regular support, feel free to contact me on Discord at `itzcrazykns`.

Thank you for exploring Vane, the AI-powered search engine designed to enhance your search experience. We are constantly working to improve Vane and expand its capabilities. We value your feedback and contributions which help us make Vane even better. Don't forget to check back for updates and new features!
