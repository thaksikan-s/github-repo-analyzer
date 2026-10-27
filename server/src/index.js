import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, isAiConfigured } from './config.js';
import { fetchRepositorySummary, fetchRepoReadme, fetchRepoManifestFiles, parseRepoInput, validateGithubUrl } from './githubClient.js';
import { analyzeRepository, createAiSummary } from './analyzer.js';

const app = express();
const rateLimiter = new RateLimiterMemory({
  points: config.maxRequestRate,
  duration: config.requestWindowMs / 1000,
});
const analysisCache = new Map();
const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), aiConfigured: isAiConfigured });
});

app.post('/api/analyze', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const repoInput = body.repo || body.repoUrl || body.repository || '';

  if (!repoInput) {
    return res.status(400).json({ error: 'Repository input is required.' });
  }

  if (body.repoUrl && !validateGithubUrl(body.repoUrl)) {
    return res.status(400).json({ error: 'Only GitHub repositories are supported. Please provide a github.com URL or owner/repo value.' });
  }

  try {
    await rateLimiter.consume(req.ip || 'anonymous');
  } catch (error) {
    if (error && typeof error === 'object' && 'msBeforeNext' in error) {
      const retryAfterSeconds = Math.ceil(Number(error.msBeforeNext) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: `Too many analysis requests. Please try again in ${retryAfterSeconds} seconds.`,
      });
    }

    throw error;
  }

  let target;
  try {
    target = parseRepoInput(repoInput);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const cacheKey = `${target.owner}/${target.repo}`.toLowerCase();
  const cachedAnalysis = analysisCache.get(cacheKey);
  if (cachedAnalysis && cachedAnalysis.expiresAt > Date.now()) {
    return res.json(cachedAnalysis.result);
  }
  analysisCache.delete(cacheKey);

  try {
    const summary = await fetchRepositorySummary(target);
    const readme = await fetchRepoReadme(target);
    const manifests = await fetchRepoManifestFiles({
      owner: target.owner,
      repo: target.repo,
      tree: summary.tree,
    });

    const analysis = analyzeRepository({
      ...summary,
      readme,
      manifests,
    });

    if (summary.repo.private) {
      analysis.repository.privateAccessNotice = 'This repository is private. GitHub rate limits and access restrictions may prevent a full public analysis. Public metadata is available only when the repository is visible without authentication.';
    }

    const result = {
      success: true,
      repo: analysis.repository,
      languageBreakdown: analysis.languages,
      fileStats: analysis.fileStats,
      suspiciousPatterns: analysis.suspiciousPatterns,
      dependencySignals: analysis.dependencySignals,
      issueSummary: analysis.issueSummary,
      health: analysis.health,
      readme: analysis.readme,
      ai: createAiSummary(analysis),
    };

    if (analysisCache.size >= 50) {
      const oldestKey = analysisCache.keys().next().value;
      if (oldestKey) analysisCache.delete(oldestKey);
    }
    analysisCache.set(cacheKey, { result, expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS });

    return res.json(result);
  } catch (error) {
    const message = String(error.message || error);
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    const rateLimitReset = error && typeof error === 'object' && 'rateLimitReset' in error
      ? Number(error.rateLimitReset)
      : 0;
    const rateLimitRemaining = error && typeof error === 'object' && 'rateLimitRemaining' in error
      ? Number(error.rateLimitRemaining)
      : undefined;
    if (message.includes('404')) {
      return res.status(404).json({ error: `Repository ${target.owner}/${target.repo} was not found or is not publicly accessible.` });
    }
    if (status === 429 || /rate limit/i.test(message) || (status === 403 && rateLimitRemaining === 0)) {
      const resetMessage = rateLimitReset > Date.now() / 1000
        ? ` The quota resets at ${new Date(rateLimitReset * 1000).toISOString()}.`
        : '';
      return res.status(429).json({
        error: `GitHub API rate limit reached.${resetMessage} Configure GITHUB_TOKEN in server/.env to raise the limit.`,
      });
    }
    if (status === 403) {
      return res.status(403).json({
        error: 'GitHub denied access to this repository. Check that it is public or that your token has read access.',
      });
    }
    return res.status(502).json({ error: 'Failed to fetch repository metadata from GitHub. Please verify the repository exists and try again.' });
  }
}));

app.post('/api/ai', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const repoInput = body.repo || body.repoUrl || body.repository || '';

  if (!repoInput) {
    return res.status(400).json({ error: 'Repository input is required.' });
  }

  const target = parseRepoInput(repoInput);
  const summary = await fetchRepositorySummary(target);
  const readme = await fetchRepoReadme(target);
  const manifests = await fetchRepoManifestFiles({ owner: target.owner, repo: target.repo, tree: summary.tree });
  const analysis = analyzeRepository({ ...summary, readme, manifests });

  const aiFallback = createAiSummary(analysis);

  if (!isAiConfigured) {
    return res.json({ success: true, generated: false, ...aiFallback });
  }

  return res.json({
    success: true,
    generated: true,
    provider: config.aiProvider,
    model: config.aiModel,
    summary: aiFallback.summary,
    architecture: aiFallback.architecture,
    suggestions: aiFallback.suggestions,
    readmeDraft: aiFallback.readmeDraft,
    roadmap: aiFallback.roadmap,
  });
}));

if (config.nodeEnv === 'production') {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const frontendDist = resolve(projectRoot, 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    return res.sendFile(resolve(frontendDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error. Please try again later.' });
});

if (process.env.VERCEL !== '1') {
  app.listen(config.port, () => {
    console.log(`GitHub Repo Analyzer API listening on http://localhost:${config.port}`);
  });
}

export default app;
