import { startWebSocketServer } from './websocket';
import express from 'express';
import cors from 'cors';
import http from 'http';
import routes from './routes';
import { getPort } from './config';
import logger from './utils/logger';
import job from './services/discover.cron';
import connectToMongo from './database/mongodb/mongodb';

job.start();

const port = getPort();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: '*',
};



(async () => {
    try {
        await connectToMongo();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
})();

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', routes);
app.get('/api', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

server.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

startWebSocketServer(server);
