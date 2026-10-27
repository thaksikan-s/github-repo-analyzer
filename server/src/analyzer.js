const safeText = (value) => typeof value === 'string' ? value.trim() : '';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const scoreRepository = (analysis) => {
  const { repo, languages, issues, contributors, releases, tree, readme, manifests } = analysis;
  const fileCount = tree?.tree?.length || 0;
  const largeFiles = (tree?.tree || []).filter((item) => item && (item.size || 0) > 250000).length;
  const hasReadme = Boolean(readme && readme.content && readme.content.length > 100);
  const hasTests = Boolean((tree?.tree || []).some((item) => /(^|\/)(test|tests|__tests__|spec|specs)(\/|$)/.test(item.path)) || (tree?.tree || []).some((item) => /\.(test|spec)\.[jt]sx?$/.test(item.path)));
  const hasWorkflow = Boolean((tree?.tree || []).some((item) => item.path.includes('.github/workflows/')));
  const hasLicense = Boolean((tree?.tree || []).some((item) => item.path.toLowerCase().includes('license')));
  const openIssues = (issues || []).filter((issue) => issue && issue.state === 'open').length;
  const releaseCount = Array.isArray(releases) ? releases.length : 0;
  const contributorCount = Array.isArray(contributors) ? contributors.length : 0;

  let score = 70;
  if (hasReadme) score += 8;
  if (hasTests) score += 10;
  if (hasWorkflow) score += 7;
  if (hasLicense) score += 5;
  if (releaseCount > 0) score += 6;
  if (contributorCount >= 3) score += 7;
  if (fileCount > 200) score -= 6;
  if (largeFiles > 0) score -= Math.min(8, largeFiles * 2);
  if (openIssues > 20) score -= 4;
  if (!repo?.has_issues) score -= 2;
  if (repo?.stargazers_count && repo.stargazers_count > 1000) score += 4;

  const categories = {
    documentation: clamp((hasReadme ? 85 : 55) + (hasLicense ? 10 : 0) + (repo?.description ? 5 : 0), 0, 100),
    organization: clamp(75 + (fileCount > 100 ? 5 : 0) - (largeFiles * 4), 0, 100),
    testing: clamp((hasTests ? 82 : 48) + (hasWorkflow ? 8 : 0), 0, 100),
    maintenance: clamp((releaseCount > 0 ? 82 : 60) + (repo?.updated_at ? 8 : 0), 0, 100),
    community: clamp((contributorCount >= 2 ? 78 : 50) + (repo?.open_issues_count ? 4 : 0) - (openIssues > 20 ? 10 : 0), 0, 100),
  };

  return {
    overall: clamp(Math.round(score), 0, 100),
    categories,
    summary: {
      hasReadme,
      hasTests,
      hasWorkflow,
      hasLicense,
      fileCount,
      largeFiles,
      openIssues,
      releaseCount,
      contributorCount,
    },
  };
};

export const analyzeRepository = (data) => {
  const repo = data.repo || {};
  const treeItems = Array.isArray(data.tree?.tree) ? data.tree.tree : [];
  const languageEntries = Object.entries(data.languages || {});
  const readme = data.readme || null;
  const manifests = data.manifests || [];
  const issues = Array.isArray(data.issues) ? data.issues : [];
  const files = treeItems.filter((item) => item && item.type === 'blob');

  const importantFiles = [
    'README.md', 'README', 'package.json', 'tsconfig.json', 'vite.config.ts', 'Dockerfile', '.github/workflows', 'LICENSE', 'pyproject.toml', 'requirements.txt', 'Cargo.toml',
  ].map((name) => {
    const match = files.find((file) => file.path.toLowerCase().includes(name.toLowerCase()) || file.path === name);
    return match ? { path: match.path, size: match.size || 0 } : null;
  }).filter(Boolean);

  const suspiciousPatterns = [];
  if (!hasReadmeContent(readme)) {
    suspiciousPatterns.push({ type: 'missing-documentation', severity: 'medium', summary: 'No README or README content was detected, so onboarding is less clear.' });
  }
  if (!hasTestsForProject(treeItems)) {
    suspiciousPatterns.push({ type: 'limited-testing', severity: 'medium', summary: 'This repository does not appear to include an obvious automated test setup.' });
  }
  if (hasLargeFiles(files)) {
    suspiciousPatterns.push({ type: 'large-file', severity: 'high', summary: 'Large tracked files may slow clones and review workflows.' });
  }
  if (!manifests.length) {
    suspiciousPatterns.push({ type: 'dependency-manifest-missing', severity: 'low', summary: 'No standard dependency manifest was detected in the repository tree.' });
  }
  if ((repo?.open_issues_count || 0) > 25 && (!repo?.has_issues || repo.has_issues === false)) {
    suspiciousPatterns.push({ type: 'issue-tracking-gap', severity: 'low', summary: 'Issue tracking may be limited or disabled despite active discussions.' });
  }
  if (files.length > 200 && !hasTestsForProject(treeItems)) {
    suspiciousPatterns.push({ type: 'organization-weakness', severity: 'medium', summary: 'Large codebases without obvious test coverage can be harder to maintain.' });
  }

  const dependencySignals = buildDependencySignals(manifests, treeItems);
  const relevantNumbers = {
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    openIssues: repo.open_issues_count || 0,
    watchers: repo.watchers_count || 0,
  };

  const analysis = {
    repository: {
      name: repo.full_name || repo.name || 'unknown/repository',
      description: safeText(repo.description) || 'No repository description was provided.',
      defaultBranch: repo.default_branch || 'main',
      visibility: repo.private ? 'Private' : 'Public',
      homepage: repo.homepage || null,
      language: repo.language || languageEntries[0]?.[0] || 'Unknown',
      createdAt: repo.created_at || null,
      updatedAt: repo.updated_at || null,
      stats: relevantNumbers,
      privateRepo: Boolean(repo.private),
    },
    languages: languageEntries.map(([name, value]) => ({ name, value })),
    fileStats: {
      totalFiles: files.length,
      largeFiles: files.filter((item) => (item.size || 0) > 250000).length,
      importantFiles,
      treePreview: treeItems.slice(0, 12).map((item) => ({ path: item.path, type: item.type, size: item.size || 0 })),
    },
    suspiciousPatterns,
    dependencySignals,
    issueSummary: {
      total: issues.length,
      open: issues.filter((issue) => issue.state === 'open').length,
      closed: issues.filter((issue) => issue.state === 'closed').length,
    },
    readme: readme ? { path: readme.path, contentPreview: readme.content.slice(0, 500) } : null,
    health: scoreRepository({
      repo,
      languages: data.languages,
      issues,
      contributors: data.contributors,
      releases: data.releases,
      tree: data.tree,
      readme,
      manifests,
    }),
  };

  return analysis;
};

function hasReadmeContent(readme) {
  return Boolean(readme && readme.content && readme.content.trim().length > 120);
}

function hasTestsForProject(treeItems) {
  return treeItems.some((item) => {
    const path = item.path.toLowerCase();
    if (path.includes('/test/') || path.includes('/tests/') || path.includes('__tests__')) return true;
    return /(?:^|\/)(?:test|tests|spec|specs)(?:\/|$)|\.(?:test|spec)\.[jt]sx?$/.test(path);
  });
}

function hasLargeFiles(files) {
  return files.some((item) => (item.size || 0) > 500000);
}

function buildDependencySignals(manifests, treeItems) {
  const packageJsonMatch = treeItems.find((item) => item.path.toLowerCase().endsWith('package.json'));
  const lockMatch = treeItems.find((item) => /(?:package-lock|yarn.lock|pnpm-lock)/.test(item.path.toLowerCase()));

  const list = [
    {
      name: 'Manifest presence',
      value: manifests.length ? 'Detected' : 'Not detected',
      detail: manifests.length ? manifests.map((m) => m.path).join(', ') : 'No standard dependency manifest found in the repository.',
      risk: manifests.length ? 'low' : 'medium',
    },
    {
      name: 'Lockfile',
      value: lockMatch ? 'Present' : 'Not present',
      detail: lockMatch ? `Lockfile detected at ${lockMatch.path}.` : 'No lockfile was found; dependency updates may be harder to reproduce consistently.',
      risk: lockMatch ? 'low' : 'medium',
    },
    {
      name: 'Package manifest',
      value: packageJsonMatch ? 'Found' : 'Missing',
      detail: packageJsonMatch ? `Package manifest available at ${packageJsonMatch.path}.` : 'No package.json file detected in the repository tree.',
      risk: packageJsonMatch ? 'low' : 'medium',
    },
  ];

  return list;
}

export const createAiSummary = (analysis) => {
  const repo = analysis.repository;
  const languages = analysis.languages.slice(0, 3).map((item) => item.name).join(', ') || 'multiple languages';

  return {
    available: false,
    provider: 'disabled',
    status: 'AI integration is not configured. The analyzer still provides actionable local insights and exports.',
    summary: `This repository, ${repo.name}, appears to focus on ${languages} with ${repo.stats.stars} stars and ${repo.stats.forks} forks. The health score suggests ${repo.privateRepo ? 'a private or restricted project' : 'a maintainable public project'} that could benefit from consistent documentation, issue tracking, and testing hygiene.`,
    architecture: 'The codebase likely follows a modular structure split between application logic, infrastructure, and configuration, with emphasis on conventions and clear source organization.',
    suggestions: [
      'Document the entry points, package layout, and contributor setup.',
      'Add or expand automated tests for important routes or modules.',
      'Keep release notes and changelog entries aligned with actual changes.',
    ],
    readmeDraft: `# ${repo.name}\n\n${repo.description}\n\n## Getting started\n\n1. Clone the repository.\n2. Install dependencies.\n3. Run the project locally with the documented development commands.\n4. Validate with tests and lint checks before submitting changes.`,
    roadmap: ['Setup developer environment', 'Improve documentation and contributor flow', 'Add targeted automated tests', 'Monitor health and dependency drift'],
  };
};
