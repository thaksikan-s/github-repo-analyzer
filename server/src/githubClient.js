import fetch from 'node-fetch';

import { config } from './config.js';

const GH = config.githubApiBase;

export const parseRepoInput = (value) => {
  if (!value || typeof value !== 'string') {
    throw new Error('Repository identifier is required.');
  }

  const trimmed = value.trim();

  if (trimmed.includes('/')) {
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    const candidate = withoutProtocol.replace(/^github\.com\//i, '');
    const parts = candidate.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [owner, repo] = parts;
      if (!owner || !repo) {
        throw new Error('Repository format must look like owner/repo or a GitHub URL.');
      }
      return { owner: owner.replace(/[^a-zA-Z0-9_.-]/g, ''), repo: repo.replace(/[^a-zA-Z0-9_.-]/g, '') };
    }
  }

  const compact = trimmed.replace(/^github:\/\//i, '');
  const parts = compact.split('/').filter(Boolean);
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }

  throw new Error('Repository format must be owner/repo or a GitHub URL.');
};

export const validateGithubUrl = (input) => {
  if (!input) return false;
  try {
    const value = String(input).trim();
    if (!value) return false;
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const isGithub = url.hostname === 'github.com' || url.hostname.endsWith('.github.com');
    if (!isGithub) return false;
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length >= 2;
  } catch {
    return false;
  }
};

const withHeaders = () => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(config.githubToken ? { Authorization: `Bearer ${config.githubToken}` } : {}),
});

const fetchJson = async (url, headers = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: { ...withHeaders(), ...headers },
      signal: controller.signal,
    });

    if (!res.ok) {
      const payload = await res.text();
      const errorText = payload && payload.length < 500 ? payload : `HTTP ${res.status}`;
      const rateLimitReset = Number(res.headers.get('x-ratelimit-reset'));
      const rateLimitRemaining = Number(res.headers.get('x-ratelimit-remaining'));
      throw Object.assign(new Error(`GitHub API request failed (${res.status}): ${errorText}`), {
        status: res.status,
        rateLimitReset: Number.isFinite(rateLimitReset) && rateLimitReset > 0 ? rateLimitReset : undefined,
        rateLimitRemaining: Number.isFinite(rateLimitRemaining) ? rateLimitRemaining : undefined,
      });
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchRepositorySummary = async ({ owner, repo }) => {
  const repoData = await fetchJson(`${GH}/repos/${owner}/${repo}`);
  const [issuesData, languagesData, contributorsData, releasesData, treeData] = await Promise.all([
    fetchJson(`${GH}/repos/${owner}/${repo}/issues?state=all&per_page=100`),
    fetchJson(`${GH}/repos/${owner}/${repo}/languages`),
    fetchJson(`${GH}/repos/${owner}/${repo}/contributors?per_page=10`),
    fetchJson(`${GH}/repos/${owner}/${repo}/releases?per_page=5`),
    fetchJson(`${GH}/repos/${owner}/${repo}/git/trees/${repoData.default_branch || 'main'}?recursive=1`),
  ]);

  return {
    repo: repoData,
    issues: issuesData,
    languages: languagesData,
    contributors: contributorsData,
    releases: releasesData,
    tree: treeData,
  };
};

export const fetchRepoReadme = async ({ owner, repo }) => {
  let readme;
  try {
    readme = await fetchJson(`${GH}/repos/${owner}/${repo}/readme`);
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return null;
    }

    throw error;
  }

  if (!readme) return null;

  if (readme.content) {
    const content = Buffer.from(readme.content, 'base64').toString('utf8');
    return { path: readme.path, content };
  }

  return null;
};

export const fetchRepoManifestFiles = async ({ owner, repo, tree }) => {
  const items = tree?.tree || [];
  const candidateNames = ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'requirements.txt', 'pyproject.toml', 'Cargo.toml'];

  return items
    .filter((item) => item && item.type === 'blob' && candidateNames.includes(item.path.split('/').pop()))
    .slice(0, 50)
    .map((item) => ({
      path: item.path,
      size: item.size || 0,
    }));
};
