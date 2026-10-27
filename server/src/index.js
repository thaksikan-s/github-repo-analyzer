import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import { config, isAiConfigured } from './config.js';
import { fetchRepositorySummary, fetchRepoReadme, fetchRepoManifestFiles, parseRepoInput, validateGithubUrl } from './githubClient.js';
import { analyzeRepository, createAiSummary } from './analyzer.js';

const app = express();
const rateLimiter = new RateLimiterMemory({
  points: config.maxRequestRate,
  duration: config.requestWindowMs / 1000,
});

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

  await rateLimiter.consume(req.ip || 'anonymous');

  let target;
  try {
    target = parseRepoInput(repoInput);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

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

    return res.json({
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
    });
  } catch (error) {
    const message = String(error.message || error);
    if (message.includes('404')) {
      return res.status(404).json({ error: `Repository ${target.owner}/${target.repo} was not found or is not publicly accessible.` });
    }
    if (message.includes('403') || message.includes('rate limit')) {
      return res.status(429).json({ error: 'GitHub API rate limit reached. Please wait a moment or configure a token in the server environment.' });
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

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error. Please try again later.' });
});

app.listen(config.port, () => {
  console.log(`GitHub Repo Analyzer API listening on http://localhost:${config.port}`);
});

export default app;
