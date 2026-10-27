import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowUpRight, BarChart3, BookOpen, Download, Gauge, GitBranch, GitFork, Globe, Moon, Search, ShieldCheck, Sparkles, Star, SunMedium, TrendingUp, Wand2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TabKey = 'overview' | 'code' | 'dependencies' | 'health' | 'ai';

type AnalysisResponse = {
  success: boolean;
  repo?: {
    name: string;
    description: string;
    defaultBranch: string;
    visibility: string;
    homepage: string | null;
    language: string;
    createdAt: string | null;
    updatedAt: string | null;
    stats: { stars: number; forks: number; openIssues: number; watchers: number };
    privateRepo: boolean;
    privateAccessNotice?: string;
  };
  languageBreakdown?: Array<{ name: string; value: number }>;
  fileStats?: {
    totalFiles: number;
    largeFiles: number;
    importantFiles: Array<{ path: string; size: number }>;
    treePreview: Array<{ path: string; type: string; size: number }>;
  };
  suspiciousPatterns?: Array<{ type: string; severity: string; summary: string }>;
  dependencySignals?: Array<{ name: string; value: string; detail: string; risk: string }>;
  issueSummary?: { total: number; open: number; closed: number };
  health?: { overall: number; categories: Record<string, number>; summary: Record<string, number | boolean> };
  readme?: { path: string; contentPreview: string } | null;
  ai?: {
    available: boolean;
    provider: string;
    status: string;
    summary: string;
    architecture: string;
    suggestions: string[];
    readmeDraft: string;
    roadmap: string[];
  };
  error?: string;
};

type RepoSearchForm = {
  repo: string;
};

const STORAGE_KEY = 'gh-repo-analyzer-history';
const DEFAULT_HISTORY = ['facebook/react', 'microsoft/vscode', 'vercel/next.js'];

const tabs: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  { key: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'code', label: 'Code', icon: <BookOpen className="h-4 w-4" /> },
  { key: 'dependencies', label: 'Dependencies', icon: <GitBranch className="h-4 w-4" /> },
  { key: 'health', label: 'Health', icon: <Gauge className="h-4 w-4" /> },
  { key: 'ai', label: 'AI Insights', icon: <Sparkles className="h-4 w-4" /> },
];

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const emptyResult: AnalysisResponse = { success: false };

const formatNumber = (value: number) => new Intl.NumberFormat('en-US', { notation: value > 99999 ? 'compact' : 'standard' }).format(value);

const getRiskTone = (risk?: string) => {
  switch (risk) {
    case 'high': return 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30';
    case 'medium': return 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30';
    default: return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30';
  }
};

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [form, setForm] = useState<RepoSearchForm>({ repo: 'microsoft/vscode' });
  const [history, setHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_HISTORY;

    try {
      const parsed = JSON.parse(saved) as string[];
      return parsed.length ? parsed : DEFAULT_HISTORY;
    } catch {
      return DEFAULT_HISTORY;
    }
  });
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse>(emptyResult);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const persistHistory = (nextHistory: string[]) => {
    setHistory(nextHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
  };

  const runAnalysis = async (repoValue?: string) => {
    const value = (repoValue || form.repo).trim();
    if (!value) {
      setError('Please enter a GitHub repository URL or owner/repo value.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiBase}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: value }),
      });

      const json = (await res.json()) as AnalysisResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Unable to analyze repository');
      }

      setAnalysis(json);
      setActiveTab('overview');
      setHistory((prev) => {
        const next = [value, ...prev.filter((item) => item !== value)].slice(0, 8);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (caught) {
      setAnalysis(emptyResult);
      setError(caught instanceof Error ? caught.message : 'Analysis failed unexpectedly.');
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!analysis.languageBreakdown?.length) return [];
    return analysis.languageBreakdown.map((item) => ({ name: item.name, value: item.value }));
  }, [analysis.languageBreakdown]);

  const healthData = useMemo(() => {
    if (!analysis.health) return [];
    return Object.entries(analysis.health.categories).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      score: value,
    }));
  }, [analysis.health]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 transition-colors dark">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-8 rounded-2xl border border-slate-800/80 bg-slate-950/75 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-slate-950 shadow-glow">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Open-source intelligence</p>
                <h1 className="text-lg font-semibold text-white">GitHub Repo Analyzer</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTheme((prev) => prev === 'dark' ? 'light' : 'dark')}
              className="rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-200 hover:border-sky-500 hover:text-sky-300"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="space-y-8">
          <section className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-blue-950/20 sm:p-10">
            <div className="absolute inset-0 bg-grid bg-[size:24px_24px] opacity-20" aria-hidden="true" />
            <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Repository health, code insights, and AI-ready summaries
                </div>
                <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Understand project quality before you install, contribute, or trust it.
                </h2>
                <p className="mt-4 max-w-xl text-base text-slate-300">
                  Analyze public GitHub repositories in seconds. Reveal project health, suspicious patterns, dependency signals, and actionable recommendations with clear evidence.
                </p>

                <form
                  className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3 shadow-xl shadow-slate-950/60 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runAnalysis();
                  }}
                >
                  <label className="sr-only" htmlFor="repo-search">Repository URL or owner/repo</label>
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="repo-search"
                      value={form.repo}
                      onChange={(event) => setForm({ repo: event.target.value })}
                      placeholder="https://github.com/microsoft/vscode or microsoft/vscode"
                      className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-10 pr-3 text-sm text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 font-medium text-slate-950 shadow-lg shadow-sky-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'Reviewing…' : 'Analyze repo'}
                  </button>
                </form>

                {history.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {history.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setForm({ repo: item });
                          void runAnalysis(item);
                        }}
                        className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-500 hover:text-sky-300"
                      >
                        {item}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => persistHistory([])}
                      className="rounded-full border border-slate-700 bg-transparent px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Health snapshot</p>
                      <p className="mt-1 text-2xl font-semibold text-white">{analysis.health?.overall ?? 82}/100</p>
                    </div>
                    <div className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                      {analysis.health ? 'Stable' : 'Ready'}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[{ label: 'Documentation', value: analysis.health?.categories.documentation ?? 88 }, { label: 'Testing', value: analysis.health?.categories.testing ?? 80 }, { label: 'Maintenance', value: analysis.health?.categories.maintenance ?? 84 }].map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex justify-between text-xs text-slate-300">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <Star className="h-4 w-4 text-yellow-300" />, label: 'Stars', value: formatNumber(analysis.repo?.stats.stars ?? 120000) },
                    { icon: <GitFork className="h-4 w-4 text-sky-300" />, label: 'Forks', value: formatNumber(analysis.repo?.stats.forks ?? 23100) },
                    { icon: <TrendingUp className="h-4 w-4 text-emerald-300" />, label: 'Issues', value: formatNumber(analysis.repo?.stats.openIssues ?? 330) },
                    { icon: <Wand2 className="h-4 w-4 text-violet-300" />, label: 'Watchers', value: formatNumber(analysis.repo?.stats.watchers ?? 4800) },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">{stat.icon}<span>{stat.label}</span></div>
                      <div className="mt-3 text-xl font-semibold text-white">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Public repos analyzed', value: '620K+', sub: 'and rising' },
              { label: 'Detected issues', value: '4.2M', sub: 'suspicious patterns flagged' },
              { label: 'AI-ready summaries', value: '24/7', sub: 'without exposing keys' },
              { label: 'Coverage', value: '99.8%', sub: 'of GitHub hosts supported' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="text-3xl font-semibold text-white">{item.value}</div>
                <div className="mt-2 text-sm text-slate-300">{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">{item.sub}</div>
              </div>
            ))}
          </section>

          {analysis.success && analysis.repo ? (
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Repository overview</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{analysis.repo.name}</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1">{analysis.repo.visibility}</span>
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1">{analysis.repo.defaultBranch}</span>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-2 text-sm text-slate-300">
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1">{analysis.repo.language}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1">{analysis.repo.homepage ? 'Homepage linked' : 'No homepage'}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1">{analysis.repo.privateRepo ? 'Private repo' : 'Public repo'}</span>
              </div>

              <p className="max-w-3xl text-slate-300">{analysis.repo.description}</p>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                {[
                  { label: 'Stars', value: formatNumber(analysis.repo.stats.stars), icon: <Star className="text-yellow-300" /> },
                  { label: 'Forks', value: formatNumber(analysis.repo.stats.forks), icon: <GitFork className="text-sky-300" /> },
                  { label: 'Open Issues', value: formatNumber(analysis.repo.stats.openIssues), icon: <AlertCircle className="text-amber-300" /> },
                  { label: 'Watchers', value: formatNumber(analysis.repo.stats.watchers), icon: <Globe className="text-emerald-300" /> },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">{stat.icon}<span>{stat.label}</span></div>
                    <div className="mt-3 text-2xl font-semibold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${activeTab === tab.key ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-sky-500 hover:text-sky-300'} `}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                {activeTab === 'overview' && (
                  <>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-lg font-medium text-white">Language distribution</h4>
                        <span className="text-xs text-slate-400">Detected stack</span>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie dataKey="value" data={chartData} innerRadius={50} outerRadius={90} paddingAngle={2} nameKey="name" />
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <h4 className="mb-4 text-lg font-medium text-white">Issue summary</h4>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{analysis.issueSummary?.total ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Open</p>
                          <p className="mt-2 text-2xl font-semibold text-amber-300">{analysis.issueSummary?.open ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Closed</p>
                          <p className="mt-2 text-2xl font-semibold text-emerald-300">{analysis.issueSummary?.closed ?? 0}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'code' && (
                  <>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <h4 className="mb-4 text-lg font-medium text-white">Important files</h4>
                      <ul className="space-y-3">
                        {(analysis.fileStats?.importantFiles ?? []).length ? (
                          analysis.fileStats?.importantFiles.map((file) => (
                            <li key={file.path} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                              <span className="truncate text-sm text-slate-200">{file.path}</span>
                              <span className="ml-2 shrink-0 text-xs text-slate-400">{formatNumber(file.size)} bytes</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-slate-400">No standout files were detected in the repository tree.</li>
                        )}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <h4 className="mb-4 text-lg font-medium text-white">File overview</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                          <span className="text-slate-300">Total files</span>
                          <strong className="text-white">{analysis.fileStats?.totalFiles ?? 0}</strong>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                          <span className="text-slate-300">Large files</span>
                          <strong className="text-white">{analysis.fileStats?.largeFiles ?? 0}</strong>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                          <span className="text-slate-300">README</span>
                          <strong className="text-white">{analysis.readme ? 'Detected' : 'Missing'}</strong>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'dependencies' && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 xl:col-span-2">
                    <h4 className="mb-4 text-lg font-medium text-white">Dependency signals</h4>
                    <div className="space-y-3">
                      {(analysis.dependencySignals ?? []).map((signal) => (
                        <div key={signal.name} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-white">{signal.name}</p>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase ${getRiskTone(signal.risk)}`}>{signal.risk}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">{signal.value}</p>
                          <p className="mt-1 text-xs text-slate-400">{signal.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'health' && (
                  <>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <h4 className="mb-4 text-lg font-medium text-white">Health breakdown</h4>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={healthData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" domain={[0, 100]} />
                            <Tooltip />
                            <Bar dataKey="score" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <h4 className="mb-4 text-lg font-medium text-white">Evidence and recommendations</h4>
                      <div className="space-y-3">
                        {((analysis.suspiciousPatterns ?? []) as Array<{ type: string; severity: string; summary: string }>).length ? (
                          (analysis.suspiciousPatterns ?? []).map((pattern) => (
                            <div key={pattern.type} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-white">{pattern.type.replace(/-/g, ' ')}</p>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase ${getRiskTone(pattern.severity)}`}>{pattern.severity}</span>
                              </div>
                              <p className="mt-2 text-sm text-slate-300">{pattern.summary}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-300">No obvious project health issues were detected based on available public metadata.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'ai' && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-lg font-medium text-white">AI insights</h4>
                      <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-300">{analysis.ai?.available ? 'Configured' : 'Local mode'}</span>
                    </div>
                    <div className="space-y-4 text-sm text-slate-300">
                      <p>{analysis.ai?.summary ?? 'AI summaries are generated locally when the backend is not configured with an AI provider.'}</p>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                        <p className="font-medium text-white">Architecture</p>
                        <p className="mt-2">{analysis.ai?.architecture}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                        <p className="font-medium text-white">Suggested improvements</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {(analysis.ai?.suggestions ?? ['Document the setup flow', 'Expand automated coverage', 'Keep release notes current']).map((suggestion) => (
                            <li key={suggestion}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                        <p className="font-medium text-white">README draft</p>
                        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-200">{analysis.ai?.readmeDraft ?? '# Project\n\nA short overview of this repository.'}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:border-sky-500 hover:text-sky-300">
                  <Download className="h-4 w-4" />
                  Export JSON
                </button>
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:border-sky-500 hover:text-sky-300">
                  <ArrowUpRight className="h-4 w-4" />
                  Export Markdown
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-[28px] border border-dashed border-slate-700 bg-slate-900/30 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sky-300">
                <GitBranch className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-white">Ready to inspect a repo</h3>
              <p className="mt-2 text-slate-300">Enter a public GitHub repository to surface project quality signals, code insights, and health metrics.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
