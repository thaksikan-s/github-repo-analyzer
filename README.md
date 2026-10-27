# GitHub Repo Analyzer

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

Create a `.env` file under the server folder:

```env
PORT=3001
GITHUB_TOKEN=
AI_PROVIDER=disabled
AI_API_KEY=
AI_MODEL=gpt-4o-mini
```

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
