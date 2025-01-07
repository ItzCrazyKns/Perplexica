import express from 'express';
import cors from 'cors';
import searchRoutes from './routes/search';
import businessRoutes from './routes/business';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/search', searchRoutes);
app.use('/api/business', businessRoutes);

export default app;
