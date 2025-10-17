import express from 'express';
import bodyParser from 'body-parser';
import { ingestRouter } from './routes/ingest';
import logger from './utils/logger';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use('/ingest', ingestRouter);

app.listen(PORT, () => {
  logger.info(`🚀 Cortex Ingest Service running on port ${PORT}`);
});
