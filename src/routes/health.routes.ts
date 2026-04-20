import express from 'express';

export const healthRouter = express.Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    const dbType = process.env.DB_TYPE || 'sqlite';
    res.json({ status: 'ok', database: dbType });
  } catch (error) {
    res.status(500).json({ status: 'error', error: 'Health check failed' });
  }
});