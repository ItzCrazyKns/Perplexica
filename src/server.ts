import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import app from './app';
import { HealthCheckService } from './lib/services/healthCheck';

const port = env.PORT || 3000;

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await HealthCheckService.checkHealth();
  res.json(health);
});

export function startServer() {
  return app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app; 