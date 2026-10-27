# GitHub Repo Analyzer

**Live app:** [github-repo-analyzer-gp6x.vercel.app](https://github-repo-analyzer-gp6x.vercel.app/)

GitHub Repo Analyzer is a full-stack open-source platform for evaluating public repositories, spotting signals of risk, understanding project structure, and generating useful reports for developers and maintainers.

## Features

- Analyze public GitHub repositories by URL or owner/repo
- Inspect metadata such as stars, forks, contributors, languages, releases, and commit activity
- Detect documentation gaps, missing tests, large files, and weak project hygiene
- Score repository health with transparent, explainable categories
- Export repository insights as JSON and Markdown summaries
- Browse results in a premium dark dashboard with responsive layouts
- Keep AI support optional and environment-driven without exposing secret keys in the frontend

## Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express
- APIs: GitHub REST API, optional AI provider adapters
- Visualization: Recharts
- Testing: Vitest + Playwright
- Deployment: Docker + GitHub Actions

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
npm --prefix frontend install
npm --prefix server install
```

### Configure environment variables

Create `server/.env` to authenticate GitHub API requests. Without a token, GitHub allows only 60 API requests per hour per public IP, which can be shared by multiple users. A fine-grained personal access token with read-only access to public repository metadata, contents, and issues raises the limit. Keep the token local and never commit or share it.

```env
PORT=3001
GITHUB_TOKEN=your_fine_grained_token
AI_PROVIDER=disabled
AI_API_KEY=
AI_MODEL=gpt-4o-mini
```

The analyzer reports repository metadata, README and file-tree signals, and basic health heuristics; it is not a full source-code or security audit.

### Run the app

```bash
npm run dev
```

This starts the Express API and the Vite frontend together.

## Project Structure

```text
.github/
Dockerfile
README.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
LICENSE
frontend/
  src/
  public/
  package.json
  vite.config.ts
server/
  src/
  package.json
```

## API Endpoints

### GET /health

Returns application health and AI configuration status.

### POST /api/analyze

Accepts a repository input such as:

```json
{ "repo": "https://github.com/microsoft/vscode" }
```

Or:

```json
{ "repo": "microsoft/vscode" }
```

Returns repository metadata, file stats, dependency signals, health scores, and AI summary placeholders.

### POST /api/ai

Returns a local AI summary payload when no provider is configured. With a valid `AI_API_KEY`, the app can be extended to call a model provider without exposing secrets to the client.

## Deployment

### Deploy to Vercel

Vercel's Hobby plan is free for personal, non-commercial projects. Import this GitHub repository at [vercel.com/new](https://vercel.com/new), keep the project root at the repository root, and deploy. The Vercel configuration builds separate `frontend` (Vite) and `server` (Express) services, routing `/api/*` to the API and other paths to the frontend. Vercel provides a `*.vercel.app` URL after deployment.

The current live deployment is [github-repo-analyzer-gp6x.vercel.app](https://github-repo-analyzer-gp6x.vercel.app/).

The Hobby plan has usage limits. Vercel may change its signup and verification requirements; if it asks for a payment card or a paid upgrade, do not continue.

### Deploy to Render

Deploy the frontend and API together as a web service using the project's Render Blueprint:

[Deploy GitHub Repo Analyzer](https://render.com/deploy?repo=https://github.com/thaksikan-s/github-repo-analyzer)

Sign in to Render, authorize access to this GitHub repository, and deploy the `github-repo-analyzer` service. Render will provide the public URL when the first deployment is ready. The free service may take a short time to wake up after inactivity. An optional `GITHUB_TOKEN` environment variable can be added in Render to increase GitHub API rate limits.

### Docker

```bash
docker build -t github-repo-analyzer .
docker run -p 3001:3001 -p 5173:5173 github-repo-analyzer
```

### GitHub Actions

The included workflow runs linting, type checks, and tests on pushes and pull requests.

## Security Notes

- Do not commit API tokens or secrets
- Treat repository content as untrusted input
- Prevent prompt injection by keeping model calls constrained and explainable
- Never claim a vulnerability without evidence from GitHub metadata or user-provided code

## Known Limitations

- Public GitHub metadata is limited without authentication
- Very large repositories can hit rate limits or return truncated trees
- AI features remain provider-configurable and require explicit setup

## Roadmap

- Add richer dependency drift detection
- Increase file-content heuristics for code smell analysis
- Add more comparison and timeline views
- Improve AI prompt safety and provider abstractions

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributor setup and issue workflows.

## License

This project is distributed under the MIT License.
