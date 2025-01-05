import express from 'express';
import cors from 'cors';
import path from 'path';
import './config/env'; // Load environment variables first
import apiRoutes from './routes/api';
import { HealthCheckService } from './lib/services/healthCheck';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API routes first
app.use('/api', apiRoutes);

// Then static files
app.use(express.static(path.join(__dirname, '../public')));

// Finally, catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server with health checks
async function startServer() {
  console.log('\n🔍 Checking required services...');
  
  const ollamaStatus = await HealthCheckService.checkOllama();
  const searxngStatus = await HealthCheckService.checkSearxNG();
  const supabaseStatus = await HealthCheckService.checkSupabase();

  console.log('\n📊 Service Status:');
  console.log('- Ollama:', ollamaStatus ? '✅ Running' : '❌ Not Running');
  console.log('- SearxNG:', searxngStatus ? '✅ Running' : '❌ Not Running');
  console.log('- Supabase:', supabaseStatus ? '✅ Connected' : '❌ Not Connected');

  app.listen(port, () => {
    console.log(`\n🚀 Server running at http://localhost:${port}`);
    console.log('-------------------------------------------');
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
