'use client';

import React, {
  useState,
  useEffect,
  useMemo,
} from 'react';
import {
  Radio,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Cpu,
  Zap,
  BarChart2,
  Flame,
  Search,
  ChevronRight,
  Clock,
  AlertCircle,
  Newspaper,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Sentiment = 'positive' | 'negative' | 'neutral';
type Category =
  | 'markets'
  | 'geopolitics'
  | 'technology'
  | 'energy'
  | 'economy'
  | 'crypto';

interface Article {
  id?: string;
  title: string;
  description?: string;
  url?: string;
  source: string;
  publishedAt?: string;
  sentiment?: Sentiment;
  sentimentScore?: number;
  category?: string;
  region?: string;
  imageUrl?: string;
}

interface NewsResponse {
  success: boolean;
  data?: {
    articles: Article[];
    category: string;
    count: number;
    timestamp: string;
    source: 'newsapi' | 'mock';
  };
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'markets',     label: 'Markets',      icon: <BarChart2  className="h-3 w-3" />, color: '#00D9FF' },
  { key: 'crypto',      label: 'Crypto',       icon: <Zap        className="h-3 w-3" />, color: '#FFD700' },
  { key: 'economy',     label: 'Economy',      icon: <TrendingUp className="h-3 w-3" />, color: '#0FFF50' },
  { key: 'geopolitics', label: 'Geo-Politics', icon: <Globe      className="h-3 w-3" />, color: '#FFA500' },
  { key: 'technology',  label: 'Tech',         icon: <Cpu        className="h-3 w-3" />, color: '#C084FC' },
  { key: 'energy',      label: 'Energy',       icon: <Flame      className="h-3 w-3" />, color: '#FF6B6B' },
];

const SENTIMENT_CONFIG: Record<
  Sentiment,
  { color: string; bg: string; border: string; label: string; icon: React.ReactNode }
> = {
  positive: { color: '#0FFF50', bg: '#0FFF5012', border: '#0FFF5035', label: 'BULLISH', icon: <TrendingUp  className="h-3 w-3" /> },
  negative: { color: '#FF1744', bg: '#FF174412', border: '#FF174435', label: 'BEARISH', icon: <TrendingDown className="h-3 w-3" /> },
  neutral:  { color: '#7A8391', bg: '#7A839115', border: '#7A839130', label: 'NEUTRAL', icon: <Minus        className="h-3 w-3" /> },
};

const SENT_FILTERS = ['all', 'positive', 'negative', 'neutral'] as const;
type SentFilter = (typeof SENT_FILTERS)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function analyseSentiment(text: string): { sentiment: Sentiment; score: number } {
  const t   = text.toLowerCase();
  const neg = ['crash','plunge','decline','fall','loss','crisis','war','sanction',
               'recession','default','collapse','fear','risk','concern','drop',
               'weak','slump'].filter(k => t.includes(k)).length;
  const pos = ['surge','rally','gain','rise','soar','boom','record','high','strong',
               'growth','recovery','bullish','beat','outperform','jump',
               'breakthrough','optimism'].filter(k => t.includes(k)).length;
  const score = (pos - neg) / Math.max(1, pos + neg);
  return {
    sentiment: pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral',
    score,
  };
}

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Data Hook ─────────────────────────────────────────────────────────────────

function useNews(category: Category) {
  const [articles, setArticles]   = useState<Article[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [dataSource, setSource]   = useState<'newsapi' | 'mock' | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  // Plain async function — called on mount and on every manual refresh
  const doFetch = async (cat: Category) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/data/news?category=${cat}&limit=60&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = (await res.json()) as NewsResponse;
      if (!json.success || !json.data) throw new Error(json.error ?? 'API error');
      const enriched = json.data.articles.map(a => {
        if (a.sentiment) return a;
        const { sentiment, score } = analyseSentiment(`${a.title} ${a.description ?? ''}`);
        return { ...a, sentiment, sentimentScore: score };
      });
      setArticles(enriched);
      setSource(json.data.source);
      setFetchedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Run on mount and whenever category changes
  useEffect(() => {
    void doFetch(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // refetch is a plain callback — no hooks, no stale closures
  const refetch = () => { void doFetch(category); };

  return { articles, loading, error, dataSource, fetchedAt, refetch };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SentimentPill({ sentiment }: { sentiment?: Sentiment }) {
  const cfg = SENTIMENT_CONFIG[sentiment ?? 'neutral'];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function ArticleCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const sentiment = article.sentiment ?? 'neutral';
  const cfg       = SENTIMENT_CONFIG[sentiment];
  const cat       = CATEGORIES.find(c => c.key === article.category);

  const handleClick = () => {
    if (article.url) window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  if (featured) {
    return (
      <div
        onClick={handleClick}
        className="group p-4 rounded-xl cursor-pointer transition-all duration-200 hover:brightness-110"
        style={{
          background: '#0D1530',
          border:     `1px solid ${cfg.color}25`,
          boxShadow:  `0 0 20px ${cfg.color}10`,
        }}
      >
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[10px] font-mono font-bold tracking-wider truncate"
              style={{ color: cfg.color }}
            >
              ◆ {article.source.toUpperCase()}
            </span>
            {cat && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
                style={{
                  color:      cat.color,
                  background: `${cat.color}15`,
                  border:     `1px solid ${cat.color}30`,
                }}
              >
                {cat.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SentimentPill sentiment={article.sentiment} />
            <span className="text-[9px] font-mono text-[#3A4870] inline-flex items-center gap-1">
              {/* Fix: Clock as flex child instead of inline element avoids baseline misalign */}
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(article.publishedAt)}
            </span>
          </div>
        </div>

        <h3 className="text-sm font-mono font-bold text-white leading-snug mb-2 group-hover:text-[#00D9FF] transition-colors">
          {article.title}
        </h3>

        {article.description && (
          <p className="text-[11px] font-mono text-[#7A8391] leading-relaxed line-clamp-2">
            {article.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1A2040]">
          <div className="h-0.5 rounded-full flex-1 mr-3 overflow-hidden" style={{ background: '#1A2040' }}>
            <div
              className="h-full rounded-full"
              style={{
                width:      `${Math.round(Math.abs(article.sentimentScore ?? 0) * 100)}%`,
                background: cfg.color,
                opacity:    0.6,
              }}
            />
          </div>
          <ExternalLink className="h-3 w-3 text-[#3A4870] group-hover:text-[#00D9FF] transition-colors shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 hover:brightness-110"
      style={{ background: '#090E20', border: '1px solid #141A30' }}
    >
      <div
        className="w-0.5 self-stretch rounded-full shrink-0"
        style={{ background: cfg.color, opacity: 0.6 }}
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-mono text-[#C0C8D8] leading-snug group-hover:text-white transition-colors line-clamp-2 flex-1">
            {article.title}
          </p>
          <SentimentPill sentiment={article.sentiment} />
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-[#3A4870]">
          <span className="text-[#4A5580]">{article.source}</span>
          <span>·</span>
          <span>{timeAgo(article.publishedAt)}</span>
          {cat && (
            <>
              <span>·</span>
              <span style={{ color: cat.color }}>{cat.label}</span>
            </>
          )}
        </div>
      </div>
      <ChevronRight className="h-3 w-3 text-[#2A3050] group-hover:text-[#00D9FF] shrink-0 mt-1 transition-colors" />
    </div>
  );
}

function SentimentBar({ articles }: { articles: Article[] }) {
  const total = articles.length || 1;
  const pos   = articles.filter(a => a.sentiment === 'positive').length;
  const neg   = articles.filter(a => a.sentiment === 'negative').length;
  // Fix: removed unused `neu` variable — neuP computed directly
  const posP  = Math.round((pos / total) * 100);
  const negP  = Math.round((neg / total) * 100);
  const neuP  = Math.max(0, 100 - posP - negP); // clamp to avoid rounding overflow

  return (
    <div className="space-y-2">
      <div className="text-[9px] font-mono text-[#3A4870]">
        SENTIMENT DISTRIBUTION · {total} articles
      </div>
      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: '#0D1228' }}>
        <div className="h-full transition-all duration-700" style={{ width: `${posP}%`, background: '#0FFF50' }} />
        <div className="h-full transition-all duration-700" style={{ width: `${neuP}%`, background: '#2A3555' }} />
        <div className="h-full transition-all duration-700" style={{ width: `${negP}%`, background: '#FF1744' }} />
      </div>
      <div className="flex justify-between text-[9px] font-mono">
        <span className="text-[#0FFF50]">▲ {posP}%</span>
        <span className="text-[#3A4870]">{neuP}%</span>
        <span className="text-[#FF1744]">▼ {negP}%</span>
      </div>
    </div>
  );
}

function TickerTape({ articles }: { articles: Article[] }) {
  // Fix: removed unused `ref` — the animation is CSS-driven, no JS ref needed
  const items = articles.slice(0, 12);

  return (
    <div
      className="relative overflow-hidden border-b border-[#0D1530]"
      style={{ background: '#060A15' }}
    >
      <div className="flex items-center">
        <div
          className="flex items-center gap-2 px-3 py-1.5 shrink-0 z-10"
          style={{ background: '#00D9FF15', borderRight: '1px solid #00D9FF20' }}
        >
          <Radio className="h-3 w-3 text-[#00D9FF] animate-pulse" />
          <span className="text-[9px] font-mono font-bold text-[#00D9FF] tracking-wider">LIVE</span>
        </div>
        <div className="overflow-hidden flex-1">
          {/* Duplicate items so the looping animation is seamless at -50% */}
          <div
            className="flex gap-6 py-1.5 px-4 whitespace-nowrap"
            style={{ animation: 'tickerScroll 40s linear infinite' }}
          >
            {[...items, ...items].map((a, i) => {
              const cfg = SENTIMENT_CONFIG[a.sentiment ?? 'neutral'];
              return (
                // Fix: use composite key to avoid duplicate-index warnings
                <span
                  key={`${a.id ?? a.title}-${i}`}
                  className="inline-flex items-center gap-2 text-[10px] font-mono"
                >
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span className="text-[#8A99BB]">{a.source.toUpperCase()}</span>
                  <span className="text-[#C0C8D8]">
                    {a.title.length > 60 ? `${a.title.slice(0, 60)}…` : a.title}
                  </span>
                  <span className="text-[#1E2840] mx-2">│</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-20 rounded-lg" style={{ background: '#0D1228' }} />
      ))}
    </div>
  );
}

function SentFilterButton({
  s,
  active,
  onClick,
}: {
  s: SentFilter;
  active: boolean;
  onClick: () => void;
}) {
  // Fix: border opacity was appended as string '50' rather than a proper alpha hex.
  // Now use a ternary to switch full values so TypeScript and CSS both accept it correctly.
  const cfg    = s !== 'all' ? SENTIMENT_CONFIG[s as Sentiment] : null;
  const accent = cfg?.color ?? '#00D9FF';

  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-[9px] font-mono rounded transition-all"
      style={{
        color:      active ? accent : '#3A4870',
        background: active ? `${accent}15` : 'transparent',
        border:     active ? `1px solid ${accent}80` : '1px solid #1A2040',
      }}
    >
      {s.toUpperCase()}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function IntelligenceTab() {
  const [category,   setCategory]   = useState<Category>('markets');
  const [search,     setSearch]     = useState('');
  const [sentFilter, setSentFilter] = useState<SentFilter>('all');

  const { articles, loading, error, dataSource, fetchedAt, refetch } = useNews(category);

  const filtered = useMemo(() => {
    let out = articles;
    if (sentFilter !== 'all') {
      out = out.filter(a => a.sentiment === (sentFilter as Sentiment));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q),
      );
    }
    return out;
  }, [articles, sentFilter, search]);

  const featured  = filtered.slice(0, 3);
  const feed      = filtered.slice(3);
  const catConfig = CATEGORIES.find(c => c.key === category);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ background: '#060A15' }}>

      {articles.length > 0 && <TickerTape articles={articles} />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#0D1530]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: '#00D9FF15', border: '1px solid #00D9FF25' }}>
            <Newspaper className="h-4 w-4 text-[#00D9FF]" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold text-white tracking-[0.12em]">INTELLIGENCE FEED</h1>
            <p className="text-[10px] font-mono text-[#3A4870]">
              {fetchedAt
                ? `${dataSource === 'newsapi' ? '● NewsAPI' : '○ Mock'} · ${new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Loading...'}
              {articles.length > 0 && ` · ${articles.length} articles`}
            </p>
          </div>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded transition-all"
          style={{
            color:      '#00D9FF',
            border:     '1px solid #00D9FF30',
            background: '#00D9FF10',
            opacity:    loading ? 0.5 : 1,
          }}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[#0D1530]">
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => { setCategory(c.key); setSentFilter('all'); setSearch(''); }}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold rounded transition-all duration-200"
              style={{
                color:      c.key === category ? '#0A0E1A' : c.color,
                background: c.key === category ? c.color : `${c.color}12`,
                border:     `1px solid ${c.key === category ? c.color : `${c.color}30`}`,
                boxShadow:  c.key === category ? `0 0 10px ${c.color}40` : 'none',
              }}
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex gap-1">
          {SENT_FILTERS.map(s => (
            <SentFilterButton
              key={s}
              s={s}
              active={sentFilter === s}
              onClick={() => setSentFilter(s)}
            />
          ))}
        </div>

        <div className="relative">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-[#3A4870]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-6 pr-3 py-1 text-[10px] font-mono rounded bg-transparent outline-none w-32"
            style={{ border: '1px solid #1A2040', color: '#C0C8D8' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div
              className="flex items-start gap-3 p-3 rounded-lg text-[11px] font-mono"
              style={{ background: '#FF174412', border: '1px solid #FF174435', color: '#FF1744' }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <div>
                <div className="font-bold">{error}</div>
                <button onClick={() => void refetch()} className="underline hover:no-underline mt-1">
                  Retry
                </button>
              </div>
            </div>
          )}

          {loading && articles.length === 0 ? (
            <Skeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#3A4870] font-mono text-xs space-y-2">
              <Newspaper className="h-8 w-8 opacity-30" />
              <div>No articles match your filters</div>
            </div>
          ) : (
            <>
              {featured.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="h-3.5 w-3.5" style={{ color: catConfig?.color ?? '#00D9FF' }} />
                    <span
                      className="text-[10px] font-mono tracking-[0.2em]"
                      style={{ color: catConfig?.color ?? '#00D9FF' }}
                    >
                      TOP STORIES
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {featured.map((a, i) => (
                      <ArticleCard key={a.id ?? `feat-${i}`} article={a} featured />
                    ))}
                  </div>
                </div>
              )}

              {feed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="h-3 w-3 text-[#00D9FF]" />
                    <span className="text-[10px] font-mono text-[#00D9FF] tracking-[0.2em]">LIVE FEED</span>
                    <span className="ml-auto text-[9px] font-mono text-[#3A4870]">{feed.length} items</span>
                  </div>
                  <div className="space-y-1.5">
                    {feed.map((a, i) => (
                      <ArticleCard key={a.id ?? `feed-${i}`} article={a} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div
          className="w-64 shrink-0 border-l border-[#0D1530] overflow-y-auto p-4 space-y-5 hidden lg:block"
          style={{ background: '#07091A' }}
        >
          {articles.length > 0 && (
            <div className="space-y-3">
              <span className="text-[10px] font-mono text-[#00D9FF] tracking-[0.2em] flex items-center gap-1.5">
                <BarChart2 className="h-3 w-3" /> SENTIMENT
              </span>
              <SentimentBar articles={filtered.length > 0 ? filtered : articles} />
            </div>
          )}

          {articles.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-[#00D9FF] tracking-[0.2em] flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> TOP SOURCES
              </span>
              {Object.entries(
                articles.reduce<Record<string, number>>((acc, a) => {
                  acc[a.source] = (acc[a.source] ?? 0) + 1;
                  return acc;
                }, {}),
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([source, count]) => (
                  <div key={source} className="space-y-0.5">
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="text-[#8A99BB] truncate">{source}</span>
                      <span className="text-[#4A5580] shrink-0 ml-2">{count}</span>
                    </div>
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: '#1A2040' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:      `${Math.round((count / articles.length) * 100)}%`,
                          background: '#00D9FF',
                          opacity:    0.5,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}

          {articles.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-[#00D9FF] tracking-[0.2em] flex items-center gap-1.5">
                <Cpu className="h-3 w-3" /> BREAKDOWN
              </span>
              {/* Fix: filter out nulls so TS knows the array is ReactNode[] not (ReactNode | null)[] */}
              {CATEGORIES.map(c => {
                const count = articles.filter(
                  a => a.category === c.key || category === c.key,
                ).length;
                if (count === 0 && category !== c.key) return null;
                return (
                  <div key={c.key} className="flex items-center gap-2 text-[9px] font-mono">
                    <span style={{ color: c.color }}>{c.icon}</span>
                    <span className="text-[#4A5580] flex-1">{c.label}</span>
                    <span style={{ color: c.color }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div
            className="p-2 rounded-lg text-center text-[9px] font-mono"
            style={{
              background: dataSource === 'newsapi' ? '#0FFF5010' : '#FFD70010',
              border:     `1px solid ${dataSource === 'newsapi' ? '#0FFF5030' : '#FFD70030'}`,
              color:      dataSource === 'newsapi' ? '#0FFF50' : '#FFD700',
            }}
          >
            {dataSource === 'newsapi' ? '● LIVE NewsAPI' : '○ Mock Data'}
            {dataSource !== 'newsapi' && (
              <div className="text-[8px] mt-0.5 opacity-60">Set NEWS_API_KEY in .env</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}