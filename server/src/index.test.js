import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from './index.js';

vi.mock('./githubClient.js', () => ({
  parseRepoInput: (value) => {
    if (!value) throw new Error('Repository identifier is required.');
    const trimmed = String(value).trim();
    const [owner, repo] = trimmed.split('/');
    if (!owner || !repo) throw new Error('Repository format must be owner/repo or a GitHub URL.');
    return { owner, repo };
  },
  validateGithubUrl: (value) => /^https:\/\/github\.com\//i.test(String(value || '')),
  fetchRepositorySummary: async ({ owner, repo }) => ({
    repo: {
      full_name: `${owner}/${repo}`,
      name: repo,
      description: 'A sample repo',
      default_branch: 'main',
      private: false,
      stargazers_count: 42,
      forks_count: 8,
      open_issues_count: 3,
      watchers_count: 10,
      updated_at: '2024-01-05T00:00:00Z',
      has_issues: true,
    },
    issues: [{ state: 'open' }, { state: 'closed' }],
    languages: { TypeScript: 80, JavaScript: 20 },
    contributors: [{ login: 'alice' }, { login: 'bob' }],
    releases: [{ tag_name: 'v1.0.0' }],
    commitActivity: [{ total: 10 }],
    tree: { tree: [
      { path: 'README.md', type: 'blob', size: 2200 },
      { path: 'src/index.ts', type: 'blob', size: 1200 },
      { path: 'package.json', type: 'blob', size: 980 },
      { path: '.github/workflows/ci.yml', type: 'blob', size: 1200 },
      { path: 'src/index.test.ts', type: 'blob', size: 1400 },
    ] },
  }),
  fetchRepoReadme: async () => ({ path: 'README.md', content: '# Demo\n\nWelcome!\n\nThis project includes docs and tests.' }),
  fetchRepoManifestFiles: async () => [{ path: 'package.json' }],
}));

describe('GitHub repo analyzer API', () => {
  it('health check returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects malformed repository input', async () => {
    const res = await request(app).post('/api/analyze').send({ repo: 'bad-input' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/owner\/repo|GitHub/); 
  });

  it('analyzes a valid repo and returns structured metadata', async () => {
    const res = await request(app).post('/api/analyze').send({ repo: 'octocat/hello-world' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.repo.name).toBe('octocat/hello-world');
    expect(res.body.health.overall).toBeGreaterThan(0);
  });
});
