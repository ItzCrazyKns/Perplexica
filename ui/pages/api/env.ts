
import process from 'process';

export default function handler(req, res) {
  const envVars = {
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    BACKEND_WS_URL: process.env.BACKEND_WS_URL
  }
  res.status(200).json(envVars);
}
