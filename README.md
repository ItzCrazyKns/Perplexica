# BizSearch

A tool for finding and analyzing local businesses using AI-powered data extraction.

## Prerequisites

- Node.js 16+
- Ollama (for local LLM)
- SearxNG instance

## Installation

1. Install Ollama:
```bash
# On macOS
brew install ollama
```

2. Start Ollama:
```bash
# Start and enable on login
brew services start ollama

# Or run without auto-start
/usr/local/opt/ollama/bin/ollama serve
```

3. Pull the required model:
```bash
ollama pull mistral
```

4. Clone and set up the project:
```bash
git clone https://github.com/yourusername/bizsearch.git
cd bizsearch
npm install
```

5. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

6. Start the application:
```bash
npm run dev
```

7. Open http://localhost:3000 in your browser

## Troubleshooting

If Ollama fails to start:
```bash
# Stop any existing instance
brew services stop ollama
# Wait a few seconds
sleep 5
# Start again
brew services start ollama
```

To verify Ollama is running:
```bash
curl http://localhost:11434/api/version
```

## Features

- Business search with location filtering
- Contact information extraction
- AI-powered data validation
- Clean, user-friendly interface
- Service health monitoring

## Configuration

Key environment variables:
- `SEARXNG_URL`: Your SearxNG instance URL
- `OLLAMA_URL`: Ollama API endpoint (default: http://localhost:11434)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `CACHE_DURATION_DAYS`: How long to cache results (default: 7)

## Supabase Setup

1. Create a new Supabase project
2. Run the SQL commands in `db/init.sql` to create the cache table
3. Copy your project URL and anon key to `.env`

## License

MIT

## Cache Management

The application uses Supabase for caching search results. Cache entries expire after 7 days.

### Manual Cache Cleanup

If automatic cleanup is not available, you can manually clean up expired entries:

1. Using the API:
```bash
curl -X POST http://localhost:3000/api/cleanup
```

2. Using SQL:
```sql
select manual_cleanup();
```

### Cache Statistics

View cache statistics using:
```sql
select * from cache_stats;
```
