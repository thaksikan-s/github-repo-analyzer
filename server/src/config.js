import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  githubToken: process.env.GITHUB_TOKEN || '',
  aiProvider: process.env.AI_PROVIDER || 'disabled',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  githubApiBase: 'https://api.github.com',
  maxTreeItems: 200,
  maxFileBytes: 500000,
  maxRequestRate: Number(process.env.MAX_REQUEST_RATE || 60),
  requestWindowMs: Number(process.env.REQUEST_WINDOW_MS || 60000),
};

export const isAiConfigured = Boolean(config.aiProvider && config.aiProvider !== 'disabled' && config.aiApiKey);
