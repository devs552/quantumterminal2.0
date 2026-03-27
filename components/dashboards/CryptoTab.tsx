'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { SpotMarket } from './SpotMarket';
import { DerivativesMarket } from './Derivativesmarket';
import CryptoCountTab from './Cryptocounttab';
import BitcoinTreasuriesTab from './Bitcointreasuriestab';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CryptoAsset {
  symbol: string;
  name?: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap?: number;
  dominance?: number;
}

interface ApiSummary {
  totalMarketCap: number;
  btcDominance: number;
  top3Change: number[];
}

interface CryptoApiResponse {
  success: boolean;
  data: {
    cryptos: CryptoAsset[];
    timestamp: string;
    source: 'coingecko' | 'mock';
    detailed?: boolean;
  };
  timestamp: string;
  summary?: ApiSummary;
}const ETF_MOCK_DATA = [
  { date: '1 Feb', btc: 320e6,  eth: 80e6   },
  { date: '3 Feb', btc: -180e6, eth: -40e6  },
  { date: '5 Feb', btc: 450e6,  eth: 120e6  },
  { date: '6 Feb', btc: -220e6, eth: -60e6  },
  { date: '7 Feb', btc: -800e6, eth: -200e6 },
  { date: '10 Feb',btc: 200e6,  eth: 50e6   },
  { date: '12 Feb',btc: -150e6, eth: -30e6  },
  { date: '13 Feb',btc: 350e6,  eth: 90e6   },
  { date: '14 Feb',btc: -400e6, eth: -100e6 },
  { date: '17 Feb',btc: 600e6,  eth: 150e6  },
  { date: '18 Feb',btc: -250e6, eth: -70e6  },
  { date: '20 Feb',btc: -100e6, eth: -20e6  },
  { date: '21 Feb',btc: 780e6,  eth: 190e6  },
  { date: '24 Feb',btc: 480e6,  eth: 110e6  },
  { date: '25 Feb',btc: -120e6, eth: -30e6  },
  { date: '26 Feb',btc: -70e6,  eth: -15e6  },
  { date: '07 March',btc: 140e6,  eth: 35e6   },
  { date: '28 March',btc: -70e6,  eth: -18e6  },
];

type SortKey = 'dominance' | 'change';
type CryptoSubTab = 'pro' | 'flow' | 'cmp' | 'spot' | 'derivatives' | 'CryptoCount'| 'bitcoinTreasury';

const TV_SYMBOL_MAP: Record<string, string> = {
  BTC:  'BINANCE:BTCUSDT',
  ETH:  'BINANCE:ETHUSDT',
  SOL:  'BINANCE:SOLUSDT',
  BNB:  'BINANCE:BNBUSDT',
  XRP:  'BINANCE:XRPUSDT',
  ADA:  'BINANCE:ADAUSDT',
  AVAX: 'BINANCE:AVAXUSDT',
  DOGE: 'BINANCE:DOGEUSDT',
};

const INTERVALS = [
  { label: '1m', value: '1'   },
  { label: '5m', value: '5'   },
  { label: '15m',value: '15'  },
  { label: '1h', value: '60'  },
  { label: '4h', value: '240' },
  { label: '1D', value: 'D'   },
  { label: '1W', value: 'W'   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function safeFixed(n: number | undefined | null, d = 2): string {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(d);
}

// ── Small components ──────────────────────────────────────────────────────────

function Change({ value }: { value: number | undefined | null }) {
  if (value == null || isNaN(value))
    return <span className="text-muted-foreground font-mono">—</span>;
  const pos = value >= 0;
  return (
    <span className={`flex items-center justify-end gap-1 font-mono text-xs ${pos ? 'text-green-400' : 'text-red-400'}`}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const live = source === 'coingecko';
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ml-2 ${live ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
      {live ? 'COINGECKO LIVE' : 'MOCK DATA'}
    </span>
  );
}

function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 rounded bg-card/50" />)}
    </div>
  );
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 mb-4 rounded bg-red-500/10 border border-red-500/30 text-xs">
      <span className="flex items-center gap-2 text-red-400"><AlertTriangle className="h-3 w-3" /> {msg}</span>
      <button onClick={onRetry} className="text-red-400 hover:text-red-200 underline ml-4">Retry</button>
    </div>
  );
}

// ── TradingView Chart ─────────────────────────────────────────────────────────

function TradingViewChart({ symbol, interval, height = 520 }: { symbol: string; interval: string; height?: number }) {
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart`
    + `&symbol=${encodeURIComponent(symbol)}`
    + `&interval=${interval}`
    + `&hidesidetoolbar=0&hidetoptoolbar=0&saveimage=0`
    + `&toolbarbg=0A0E27&theme=dark&style=1&timezone=Etc%2FUTC`
    + `&studies=STD%3BVolume%1FSTD%3BVWAP&locale=en`;

  return (
    <div style={{ height }} className="w-full rounded overflow-hidden bg-[#0A0E27]">
      <iframe key={`${symbol}-${interval}`} src={src}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allowFullScreen title="TradingView Chart" />
    </div>
  );
}

// ── Crypto Heatmap ────────────────────────────────────────────────────────────

function CryptoHeatmapWidget({ height = 400 }: { height?: number }) {
  const src = `https://s.tradingview.com/embed-widget/crypto-coins-heatmap/?locale=en`
    + `#%7B%22dataSource%22%3A%22Crypto%22%2C%22blockSize%22%3A%22market_cap_calc%22%2C%22blockColor%22%3A%22change%22%2C%22colorTheme%22%3A%22dark%22%2C%22hasTopBar%22%3Atrue%2C%22isDataSetEnabled%22%3Atrue%2C%22isZoomEnabled%22%3Atrue%2C%22hasSymbolTooltip%22%3Atrue%7D`;

  return (
    <div style={{ height }} className="w-full rounded overflow-hidden">
      <iframe src={src} style={{ width: '100%', height: '100%', border: 'none' }} title="Crypto Heatmap" />
    </div>
  );
}

// ── TradingView Mini Symbol Widget (ticker sparkline) ─────────────────────────

function TVMiniSymbol({ symbol, isUp }: { symbol: string; isUp: boolean }) {
  const config = JSON.stringify({
    symbol,
    width: '100%',
    height: '100%',
    locale: 'en',
    dateRange: '1D',
    colorTheme: 'dark',
    isTransparent: true,
    autosize: true,
    largeChartUrl: '',
    chartOnly: true,
    noTimeScale: true,
    lineColor: isUp ? '#22c55e' : '#ef4444',
    topColor: isUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
    bottomColor: 'rgba(0,0,0,0)',
  });
  const encoded = encodeURIComponent(config);
  return (
    <div style={{ width: 80, height: 32 }} className="overflow-hidden">
      <iframe
        src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=en#${encoded}`}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={`${symbol} mini`}
      />
    </div>
  );
}

// ── Fear & Greed Gauge ────────────────────────────────────────────────────────

function FearGreedGauge({ value, label }: { value: number; label: string }) {
  // Arc from -180 to 0 degrees (semicircle)
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const angle = -180 + pct * 180; // degrees
  const rad = (angle * Math.PI) / 180;
  const cx = 60, cy = 60, r = 44;
  const needleX = cx + r * Math.cos(rad);
  const needleY = cy + r * Math.sin(rad);

  // Color stops for arc segments
  const segments = [
    { color: '#ef4444', start: -180, end: -144 }, // Extreme Fear 0-20
    { color: '#f97316', start: -144, end: -108 }, // Fear 20-40
    { color: '#eab308', start: -108, end: -72  }, // Neutral 40-60
    { color: '#84cc16', start: -72,  end: -36  }, // Greed 60-80
    { color: '#22c55e', start: -36,  end: 0    }, // Extreme Greed 80-100
  ];

  function arcPath(startDeg: number, endDeg: number): string {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg   * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={120} height={72} viewBox="0 0 120 72">
        {segments.map(seg => (
          <path key={seg.color} d={arcPath(seg.start, seg.end)}
            fill="none" stroke={seg.color} strokeWidth="8" strokeLinecap="butt" />
        ))}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY}
          stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="white" />
        {/* Value */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill="white"
          fontSize="18" fontWeight="bold" fontFamily="monospace">{value}</text>
      </svg>
      <div className="text-xs font-mono text-center mt-1" style={{ color: value < 25 ? '#ef4444' : value < 45 ? '#f97316' : value < 55 ? '#eab308' : value < 75 ? '#84cc16' : '#22c55e' }}>
        {label}
      </div>
    </div>
  );
}

// ── TradingView Market Overview (for ETF net flow proxy) ─────────────────────

function TVMarketCapChart({ height = 220 }: { height?: number }) {
  // TradingView Advanced Chart for TOTAL (total crypto market cap)
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tv_mcap`
    + `&symbol=CRYPTOCAP%3ATOTAL`
    + `&interval=D`
    + `&hidesidetoolbar=1&hidetoptoolbar=0&saveimage=0`
    + `&toolbarbg=0A0E27&theme=dark&style=3`
    + `&timezone=Etc%2FUTC&locale=en`;
  return (
    <div style={{ height }} className="w-full rounded overflow-hidden bg-[#0A0E27]">
      <iframe src={src} style={{ width: '100%', height: '100%', border: 'none' }}
        title="Total Market Cap Chart" />
    </div>
  );
}

function TVBTCDominanceChart({ height = 220 }: { height?: number }) {
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tv_btcdom`
    + `&symbol=CRYPTOCAP%3ABTC.D`
    + `&interval=D`
    + `&hidesidetoolbar=1&hidetoptoolbar=0&saveimage=0`
    + `&toolbarbg=0A0E27&theme=dark&style=1`
    + `&timezone=Etc%2FUTC&locale=en`;
  return (
    <div style={{ height }} className="w-full rounded overflow-hidden bg-[#0A0E27]">
      <iframe src={src} style={{ width: '100%', height: '100%', border: 'none' }}
        title="BTC Dominance Chart" />
    </div>
  );
}

function TVETFChart({ ticker, height = 160 }: { ticker: string; height?: number }) {
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tv_etf_${ticker}`
    + `&symbol=${encodeURIComponent(ticker)}`
    + `&interval=D`
    + `&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0`
    + `&toolbarbg=0A0E27&theme=dark&style=3`
    + `&timezone=Etc%2FUTC&locale=en`;
  return (
    <div style={{ height }} className="w-full rounded overflow-hidden bg-[#0A0E27]">
      <iframe src={src} style={{ width: '100%', height: '100%', border: 'none' }}
        title={`${ticker} ETF Chart`} />
    </div>
  );
}

function TVTickerTape({ symbols }: { symbols: string[] }) {
  // Single symbol mini chart for ticker row
  const config = JSON.stringify({
    symbols: symbols.map(s => ({ proName: s, title: s.split(':')[1]?.replace('USDT','') ?? s })),
    showSymbolLogo: false,
    isTransparent: true,
    displayMode: 'adaptive',
    colorTheme: 'dark',
    locale: 'en',
  });
  return (
    <div style={{ height: 46 }} className="w-full overflow-hidden">
      <iframe
        src={`https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#${encodeURIComponent(config)}`}
        style={{ width: '100%', height: 50, border: 'none' }}
        title="Ticker Tape"
      />
    </div>
  );
}

// ── Bar Chart (ETF Netflow) — kept as interactive code chart ─────────────────

function ETFNetflowChart({ data }: {
  data: { date: string; btc: number; eth: number }[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxAbs = Math.max(...data.map(d => Math.max(Math.abs(d.btc), Math.abs(d.eth))), 1);
  const chartH = 180;

  return (
    <div className="relative w-full" style={{ height: chartH + 40 }}>
      <div className="flex items-end gap-1 w-full" style={{ height: chartH }}>
        {data.map((d, i) => {
          const btcH = (Math.abs(d.btc) / maxAbs) * (chartH / 2 - 4);
          const ethH = (Math.abs(d.eth) / maxAbs) * (chartH / 2 - 4);
          const isHov = hovered === i;
          return (
            <div key={i} className="flex-1 flex flex-col items-center relative cursor-pointer"
              style={{ height: chartH }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}>
              <div className="flex-1 flex items-end justify-center gap-[1px] w-full pb-px">
                {d.btc > 0 && <div style={{ height: btcH, background: '#f59e0b', width: '40%', borderRadius: '2px 2px 0 0', opacity: isHov ? 1 : 0.8 }} />}
                {d.eth > 0 && <div style={{ height: ethH, background: '#60a5fa', width: '40%', borderRadius: '2px 2px 0 0', opacity: isHov ? 1 : 0.7 }} />}
              </div>
              <div style={{ height: 1, background: '#334155', width: '100%' }} />
              <div className="flex-1 flex items-start justify-center gap-[1px] w-full pt-px">
                {d.btc < 0 && <div style={{ height: btcH, background: '#f59e0b', width: '40%', borderRadius: '0 0 2px 2px', opacity: isHov ? 1 : 0.8 }} />}
                {d.eth < 0 && <div style={{ height: ethH, background: '#60a5fa', width: '40%', borderRadius: '0 0 2px 2px', opacity: isHov ? 1 : 0.7 }} />}
              </div>
              {isHov && (
                <div className="absolute z-10 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border/50 rounded px-2 py-1.5 text-[10px] font-mono whitespace-nowrap shadow-lg">
                  <div className="text-muted-foreground mb-0.5">{d.date}</div>
                  <div className="text-amber-400">BTC: {d.btc > 0 ? '+' : ''}${(d.btc / 1e6).toFixed(0)}M</div>
                  <div className="text-blue-400">ETH: {d.eth > 0 ? '+' : ''}${(d.eth / 1e6).toFixed(0)}M</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 px-1">
        {data.filter((_, i) => i % 4 === 0).map(d => (
          <span key={d.date} className="text-[9px] text-muted-foreground font-mono">{d.date}</span>
        ))}
      </div>
    </div>
  );
}

// ── CMP Tab ───────────────────────────────────────────────────────────────────

// Mock ETF netflow data


function CMPTab({ cryptos, summary, source, loading }: {
  cryptos: CryptoAsset[];
  summary: ApiSummary | null;
  source?: 'coingecko' | 'mock';
  loading: boolean;
}) {
  const [gasPrice, setGasPrice] = useState<{ fast: number; standard: number; slow: number } | null>(null);
  const [gasLoading, setGasLoading] = useState(true);

  const btc = cryptos.find(c => c.symbol?.toUpperCase() === 'BTC');
  const eth = cryptos.find(c => c.symbol?.toUpperCase() === 'ETH');
  const bnb = cryptos.find(c => c.symbol?.toUpperCase() === 'BNB');
  const sol = cryptos.find(c => c.symbol?.toUpperCase() === 'SOL');
  const xrp = cryptos.find(c => c.symbol?.toUpperCase() === 'XRP');
const [etfFlows, setEtfFlows] = useState (ETF_MOCK_DATA);

React.useEffect(() => {
  fetch('/api/etf?type=etf-flows')
    .then(r => r.json())
    .then(j => { if (j.success && j.data?.flows) setEtfFlows(j.data.flows); })
    .catch(() => {}); // silently fallback to mock
}, []);
  // Fetch ETH gas
  useEffect(() => {
    async function fetchGas() {
      setGasLoading(true);
      try {
        const res = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle');
        const j = await res.json();
        if (j.status === '1' && j.result) {
          setGasPrice({
            fast: parseFloat(j.result.FastGasPrice),
            standard: parseFloat(j.result.ProposeGasPrice),
            slow: parseFloat(j.result.SafeGasPrice),
          });
        } else {
          setGasPrice({ fast: 12, standard: 8, slow: 5 });
        }
      } catch {
        setGasPrice({ fast: 12, standard: 8, slow: 5 });
      } finally {
        setGasLoading(false);
      }
    }
    fetchGas();
  }, []);

  // Altcoin season index from live data
  const altcoinIndex = React.useMemo(() => {
    if (cryptos.length < 5) return 35;
    const nonBtc = cryptos.filter(c => !['BTC','USDT','USDC','DAI','BUSD','WBTC'].includes(c.symbol?.toUpperCase()));
    const btcChange = btc?.change24h ?? 0;
    const outperforming = nonBtc.filter(c => (c.change24h ?? 0) > btcChange).length;
    return Math.round((outperforming / Math.max(nonBtc.length, 1)) * 100);
  }, [cryptos, btc]);

  const altcoinLabel = altcoinIndex >= 70 ? 'Altcoin Season' : altcoinIndex <= 25 ? 'Bitcoin Season' : 'Neutral';

  // Fear & Greed heuristic
  const fearGreedValue = React.useMemo(() => {
    if (!btc) return 15;
    return Math.max(5, Math.min(95, Math.round(50 + (btc.change24h ?? 0) * 4)));
  }, [btc]);
  const fearGreedLabel = fearGreedValue < 25 ? 'Extreme Fear' : fearGreedValue < 45 ? 'Fear' : fearGreedValue < 55 ? 'Neutral' : fearGreedValue < 75 ? 'Greed' : 'Extreme Greed';

  const btcDom   = summary?.btcDominance ?? 58.6;
  const ethDom   = 10.4;
  const otherDom = Math.max(0, 100 - btcDom - ethDom);

  const tickers = [
    { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin',  asset: btc,  icon: '₿' },
    { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', asset: eth,  icon: 'Ξ' },
    { symbol: 'BINANCE:BNBUSDT', name: 'BNB',      asset: bnb,  icon: '🔶' },
    { symbol: 'BINANCE:SOLUSDT', name: 'Solana',   asset: sol,  icon: '◎' },
    { symbol: 'BINANCE:XRPUSDT', name: 'XRP',      asset: xrp,  icon: '✕' },
  ];

  return (
    <div className="space-y-4">

      {/* ══ ROW 1: Top 5 Ticker Cards ══ */}
      <div className="grid grid-cols-5 gap-0 rounded-lg overflow-hidden border border-border/30">
        {tickers.map(({ symbol, name, asset, icon }, idx) => {
          const pos = (asset?.change24h ?? 0) >= 0;
          return (
            <div key={symbol} className={`bg-card/40 px-4 py-3 flex items-center justify-between ${idx < 4 ? 'border-r border-border/30' : ''}`}>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{icon}</span>
                  <span className="text-xs font-mono text-muted-foreground">{name}</span>
                </div>
                {loading
                  ? <div className="h-5 w-20 rounded bg-card/50 animate-pulse" />
                  : <div className="text-base font-bold font-mono text-foreground">{asset ? fmt(asset.price) : '—'}</div>
                }
                {loading
                  ? <div className="h-3 w-12 rounded bg-card/50 animate-pulse mt-1" />
                  : <div className={`text-xs font-mono mt-0.5 ${pos ? 'text-green-400' : 'text-red-400'}`}>
                      {pos ? '▲' : '▼'} {Math.abs(asset?.change24h ?? 0).toFixed(2)}%
                    </div>
                }
              </div>
              {/* Inline TV area-chart sparkline */}
              {/* <div style={{ width: 100, height: 40 }} className="overflow-hidden flex-shrink-0">
                <iframe
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=sp_${idx}&symbol=${encodeURIComponent(symbol)}&interval=60&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0&toolbarbg=131722&theme=dark&style=3&timezone=Etc%2FUTC&locale=en`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={`${name} spark`}
                />
              </div> */}
            </div>
          );
        })}
      </div>

      {/* ══ ROW 2: Left column (Fear+Altcoin+CMC20) | Right (Market Cap chart) ══ */}
      <div className="grid grid-cols-3 gap-4">

        {/* LEFT: stacked stat panels */}
        <div className="flex flex-col gap-4">

          {/* Fear & Greed */}
          <div className="glass-panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground">Fear and Greed Index</h4>
              <span className="text-muted-foreground text-xs">ⓘ</span>
            </div>
            <div className="flex items-center gap-5">
              <FearGreedGauge value={fearGreedValue} label={fearGreedLabel} />
              <div>
                <div className="text-4xl font-bold font-mono" style={{ color: fearGreedValue < 25 ? '#ef4444' : fearGreedValue < 45 ? '#f97316' : fearGreedValue < 55 ? '#eab308' : '#22c55e' }}>
                  {fearGreedValue}
                </div>
                <div className="text-sm font-mono mt-0.5" style={{ color: fearGreedValue < 25 ? '#ef4444' : fearGreedValue < 45 ? '#f97316' : fearGreedValue < 55 ? '#eab308' : '#22c55e' }}>
                  {fearGreedLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Altcoin Season Index */}
          <div className="glass-panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground">Altcoin Season Index</h4>
              <span className="text-muted-foreground text-xs">ⓘ</span>
            </div>
            <div className="text-3xl font-bold font-mono text-foreground mb-0.5">
              {altcoinIndex}<span className="text-base text-muted-foreground font-normal">/100</span>
            </div>
            <div className={`text-xs font-mono mb-3 ${altcoinIndex >= 70 ? 'text-blue-400' : altcoinIndex <= 25 ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {altcoinLabel}
            </div>
            <div className="relative h-2 w-full rounded-full" style={{ background: 'linear-gradient(to right, #f59e0b 0%, #f59e0b 30%, #6366f1 60%, #3b82f6 100%)' }}>
              <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-700 shadow"
                style={{ left: `${altcoinIndex}%`, transform: 'translate(-50%, -50%)' }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1.5">
              <span>Bitcoin Season</span>
              <span>Altcoin Season</span>
            </div>
          </div>

          {/* CoinMarketCap 20 Index */}
          <div className="glass-panel p-5">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-semibold text-foreground">CoinMarketCap 20 Index</h4>
              <span className="text-muted-foreground text-xs">ⓘ</span>
            </div>
            <div className="text-3xl font-bold font-mono text-foreground">$142.35</div>
            <div className="text-xs text-green-400 font-mono mb-3">▲ 5.35%</div>
            {/* Small TV sparkline — area chart style */}
            {/* <div style={{ height: 60 }} className="w-full rounded overflow-hidden">
              <iframe
                src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_cmc20&symbol=CRYPTOCAP%3ATOTAL2&interval=D&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0&toolbarbg=131722&theme=dark&style=3&timezone=Etc%2FUTC&locale=en`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="CMC20"
              />
            </div> */}
          </div>
        </div>

        {/* RIGHT: Crypto Market Cap — big TV chart */}
        <div className="col-span-2 glass-panel p-5 flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-base font-semibold text-foreground mb-1">Crypto Market Cap</h4>
              <div className="flex gap-6">
                <div>
                  <div className="text-xs text-muted-foreground font-mono">Market Cap</div>
                  <div className="text-xl font-bold font-mono text-foreground">{summary ? fmt(summary.totalMarketCap) : '$2.36T'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-mono">Volume</div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {cryptos.length > 0 ? fmt(cryptos.reduce((s, c) => s + (c.volume24h ?? 0), 0)) : '$128.67B'}
                  </div>
                </div>
              </div>
            </div>
            {/* <div className="flex gap-1">
              {['Overview','Breakdown'].map((t,i) => (
                <button key={t} className={`px-3 py-1 text-xs font-mono rounded border transition-all ${i===0 ? 'bg-primary/20 text-primary border-primary/50' : 'text-muted-foreground border-border/30'}`}>{t}</button>
              ))}
              {['30d','1y','All'].map(t => (
                <button key={t} className="px-2 py-1 text-xs font-mono rounded border border-border/30 text-muted-foreground hover:border-primary/40 transition-all">{t}</button>
              ))}
            </div> */}
          </div>
          <div className="flex-1" style={{ minHeight: 380 }}>
            <TVMarketCapChart height={480} />
          </div>
        </div>
      </div>

      {/* ══ ROW 3: ETF Netflow (large, 2/3) | Right sidebar stats ══ */}
      <div className="grid grid-cols-3 gap-4">

        {/* ETF Netflow — 2 cols wide */}
        <div className="col-span-2 glass-panel p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Crypto ETFs Net Flow</h4>
              <span className="text-muted-foreground text-xs">ⓘ</span>
            </div>
            <div className="flex gap-1">
              {['30d','1y','All'].map((t,i) => (
                <button key={t} className={`px-2 py-1 text-xs font-mono rounded border transition-all ${i===0 ? 'bg-primary/20 text-primary border-primary/50' : 'text-muted-foreground border-border/30 hover:border-primary/40'}`}>{t}</button>
              ))}
              <button className="px-3 py-1 text-xs font-mono rounded border border-border/30 text-muted-foreground hover:border-primary/40">See More</button>
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-red-400 mb-1">
            − $69,635,000
            <span className="text-xs text-muted-foreground font-normal ml-2">Feb 27, 2026</span>
          </div>
          {/* Bar chart — taller now */}
          <ETFNetflowChart data={etfFlows} />
          <div className="text-[10px] text-muted-foreground font-mono text-right mt-1 opacity-40">© CoinMarketCap</div>
        </div>

        {/* RIGHT sidebar: Dominance + Open Interest + Volatility — stats only, no charts */}
        <div className="flex flex-col gap-3">

          {/* Bitcoin Dominance — stats + bar only */}
          <div className="glass-panel p-5 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground">Bitcoin Dominance</h4>
              <span className="text-muted-foreground text-xs">ⓘ</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>
                <span className="text-xs text-muted-foreground font-mono">Bitcoin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>
                <span className="text-xs text-muted-foreground font-mono">Ethereum</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"/>
                <span className="text-xs text-muted-foreground font-mono">Others</span>
              </div>
            </div>
            <div className="flex items-baseline gap-4 mb-3">
              <span className="text-xl font-bold font-mono text-amber-400">{btcDom.toFixed(1)}%</span>
              <span className="text-xl font-bold font-mono text-blue-400">{ethDom.toFixed(1)}%</span>
              <span className="text-xl font-bold font-mono text-slate-300">{otherDom.toFixed(1)}%</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden w-full">
              <div style={{ width: `${btcDom}%` }} className="bg-amber-400" />
              <div style={{ width: `${ethDom}%` }} className="bg-blue-400" />
              <div style={{ width: `${otherDom}%` }} className="bg-slate-500" />
            </div>
          </div>

          {/* Open Interest — stats only */}
          <div className="glass-panel p-5 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground">Open Interest</h4>
              <span className="text-muted-foreground text-xs">ⓘ</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground font-mono mb-1">Perpetuals</div>
                <div className="text-2xl font-bold font-mono text-foreground">$407.03B</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-mono mb-1">Futures</div>
                <div className="text-2xl font-bold font-mono text-foreground">$3.15B</div>
              </div>
            </div>
          </div>

          {/* Volmex Volatility — stats only */}
          <div className="glass-panel p-5 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground">Volmex Implied Volatility</h4>
              <span className="text-muted-foreground text-xs">ⓘ</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground font-mono mb-1">Bitcoin</div>
                <div className="text-3xl font-bold font-mono text-foreground">56.70</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-mono mb-1">Ethereum</div>
                <div className="text-3xl font-bold font-mono text-foreground">76.60</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ROW 4: ETH Gas — partial (like image shows just the heading) ══ */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">ETH Gas</h4>
            <span className="text-muted-foreground text-xs">ⓘ</span>
          </div>
          {gasLoading
            ? <div className="h-3 w-24 rounded bg-card/50 animate-pulse" />
            : <span className="text-xs text-green-400 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>LIVE · Etherscan
              </span>
          }
        </div>
        {gasLoading
          ? <Skeleton rows={1} />
          : <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Low',      value: gasPrice?.slow,     color: 'text-blue-400'  },
                { label: 'Average',  value: gasPrice?.standard, color: 'text-amber-400' },
                { label: 'High',     value: gasPrice?.fast,     color: 'text-green-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 rounded-lg bg-card/50 border border-border/30">
                  <div className="text-xs text-muted-foreground font-mono mb-2">{label}</div>
                  <div className={`text-2xl font-bold font-mono ${color}`}>{value ?? '—'} <span className="text-sm font-normal text-muted-foreground">Gwei</span></div>
                </div>
              ))}
            </div>
        }
      </div>

    </div>
  );

}

// ── Main component ────────────────────────────────────────────────────────────

export function CryptoTab() {
  const [activeSubTab, setActiveSubTab] = useState<CryptoSubTab>('pro');
  const [sortBy, setSortBy]             = useState<SortKey>('dominance');
  const [selectedSymbol, setSelectedSymbol]     = useState('BINANCE:BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('60');

  const [cryptos, setCryptos]     = useState<CryptoAsset[]>([]);
  const [summary, setSummary]     = useState<ApiSummary | null>(null);
  const [source, setSource]       = useState<'coingecko' | 'mock' | undefined>();
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchData = useCallback(async (sort: SortKey = sortBy) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/crypto?sort=${sort}&real=true`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json: CryptoApiResponse = await res.json();
      if (!json.success) throw new Error('API returned success: false');

      const assets = json.data?.cryptos ?? [];
      const sorted = [...assets].sort((a, b) =>
        sort === 'change'
          ? (b.change24h ?? 0) - (a.change24h ?? 0)
          : (b.marketCap ?? 0) - (a.marketCap ?? 0)
      );
      setCryptos(sorted);
      setSource(json.data?.source);
      setUpdatedAt(json.data?.timestamp ?? json.timestamp);

      if (json.summary) {
        setSummary(json.summary);
      } else if (assets.length > 0) {
        const totalMarketCap = assets.reduce((s, c) => s + (c.marketCap ?? 0), 0);
        const btc = assets.find(c => c.symbol?.toUpperCase() === 'BTC');
        const btcDominance = totalMarketCap > 0 && btc?.marketCap
          ? (btc.marketCap / totalMarketCap) * 100
          : btc?.dominance ?? 0;
        setSummary({ totalMarketCap, btcDominance, top3Change: assets.slice(0, 3).map(c => c.change24h ?? 0) });
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(), 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => { fetchData(sortBy); }, [sortBy]);

  const btc = cryptos.find(c => c.symbol?.toUpperCase() === 'BTC');
  const activeSymbolLabel = Object.entries(TV_SYMBOL_MAP).find(([, v]) => v === selectedSymbol)?.[0] ?? selectedSymbol;

  const subTabs = [
    { id: 'pro'  as CryptoSubTab, label: 'Crypto Pro',       icon: '⚡' },
    { id: 'flow' as CryptoSubTab, label: 'Order Flow & CVD', icon: '🌊' },
    { id: 'cmp'  as CryptoSubTab, label: 'CoinMarketCap',    icon: '📈' },
    {id:'spot' as CryptoSubTab, label: 'Spot vs Futures',  icon: '⚖️' },
     { id: 'derivatives' as CryptoSubTab, label: 'Derivatives',      icon: '📉' },
     { id: 'CryptoCount' as CryptoSubTab, label: 'Crypto Count', icon: '🔢' },
     {id:'bitcoinTreasury', label: 'Bitcoin Treasury', icon: '🏦'}
  ];

  const selBtn = (active: boolean) =>
    `px-3 py-1.5 text-xs font-mono rounded transition-all border ${
      active
        ? 'bg-primary text-background border-primary font-bold shadow-[0_0_8px_rgba(0,217,255,0.4)]'
        : 'text-muted-foreground border-border/40 hover:border-primary/50 hover:text-primary bg-card/30'
    }`;

  return (
    <div className="h-full flex flex-col">

      {/* ── Sub-tab bar ── */}
      <div className="terminal-header px-6 py-3 flex items-center justify-between">
        <div className="flex gap-2">
     <select 
  name="subTab" 
  id="subTab" 
  value={activeSubTab} 
  onChange={(e) => setActiveSubTab(e.target.value as CryptoSubTab)}
  className="bg-[#1a1a1a] text-sm font-mono text-foreground rounded border border-border/30 p-2 focus:outline-none"
>
  {subTabs.map((tab) => (
    <option key={tab.id} value={tab.id}>
      {tab.label} {/* Icons won't render inside a native option tag */}
    </option>
  ))}
</select>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          {updatedAt && <span>Updated {new Date(updatedAt).toLocaleTimeString()}</span>}
          <SourceBadge source={source} />
          <button onClick={() => fetchData()} disabled={loading}
            className="flex items-center gap-1 hover:text-primary transition-colors disabled:opacity-40">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && <ErrorBanner msg={error} onRetry={fetchData} />}

        {/* ─────────────────── PRO TAB ─────────────────── */}
        {activeSubTab === 'pro' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Market Cap', value: summary ? fmt(summary.totalMarketCap) : '—', color: 'text-[#00D9FF]', icon: '📊' },
                { label: 'BTC Dominance',    value: summary ? `${safeFixed(summary.btcDominance, 1)}%` : '—', color: 'text-[#FFD700]', icon: '₿' },
                { label: 'BTC Price',        value: btc ? fmt(btc.price) : '—', color: btc ? ((btc.change24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400') : 'text-foreground', icon: '💰' },
              ].map(({ label, value, color, icon }) => (
                <div key={label} className="glass-panel p-4">
                  <div className="text-xs text-muted-foreground font-mono mb-1">{icon} {label}</div>
                  {loading ? <div className="h-6 w-28 rounded bg-card/50 animate-pulse" /> : <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel p-6">
                <h4 className="text-sm font-bold text-primary mb-4">BTC DOMINANCE</h4>
                {loading ? <div className="h-48 rounded bg-card/50 animate-pulse" /> : (
                  <div className="h-48 bg-card/50 rounded border border-border/30 flex flex-col items-center justify-center gap-3">
                    <Zap className="h-6 w-6 text-[#FFD700]" />
                    <div className="text-4xl font-bold font-mono text-[#FFD700]">{safeFixed(summary?.btcDominance, 1)}%</div>
                    <div className="text-xs text-muted-foreground font-mono">of total crypto market cap</div>
                    {btc && <div className="text-sm font-mono text-foreground">BTC: {fmt(btc.marketCap)} mkt cap</div>}
                  </div>
                )}
              </div>
              <div className="glass-panel p-6">
                <h4 className="text-sm font-bold text-primary mb-4">STABLECOIN VOLUMES (24H)</h4>
                {loading ? <div className="h-48 rounded bg-card/50 animate-pulse" /> : (
                  <div className="h-48 bg-card/50 rounded border border-border/30 flex flex-col justify-center gap-3 px-6">
                    {['USDT', 'USDC', 'DAI', 'BUSD'].map(sym => {
                      const asset = cryptos.find(c => c.symbol?.toUpperCase() === sym);
                      return (
                        <div key={sym} className="flex justify-between items-center">
                          <span className="text-sm font-mono text-muted-foreground">{sym}</span>
                          <span className="text-sm font-mono">{asset ? fmt(asset.volume24h) : <span className="text-muted-foreground">N/A</span>}</span>
                          {asset && <Change value={asset.change24h} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-primary flex items-center">CRYPTO MARKET OVERVIEW <SourceBadge source={source} /></h4>
                <div className="flex gap-2">
                  {(['dominance', 'change'] as SortKey[]).map(s => (
                    <button key={s} onClick={() => setSortBy(s)} className={selBtn(sortBy === s)}>
                      {s === 'dominance' ? '↓ Market Cap' : '↓ Change'}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? <Skeleton rows={6} /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/30">
                      <tr>
                        {['#', 'Asset', 'Price', '24h %', 'Volume (24h)', 'Market Cap'].map(h => (
                          <th key={h} className={`px-3 py-3 text-muted-foreground font-mono text-xs ${h === 'Asset' || h === '#' ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cryptos.length > 0 ? cryptos.map((crypto, idx) => {
                        const tvSym = TV_SYMBOL_MAP[crypto.symbol?.toUpperCase()] ?? `BINANCE:${crypto.symbol?.toUpperCase()}USDT`;
                        return (
                          <tr key={crypto.symbol}
                            className="border-b border-border/30 hover:bg-card/30 transition-colors cursor-pointer"
                            onClick={() => { setSelectedSymbol(tvSym); setActiveSubTab('flow'); }}
                            title="Open chart">
                            <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="px-3 py-3 font-mono font-bold text-foreground">
                              {crypto.symbol?.toUpperCase()}
                              {crypto.name && <span className="ml-2 text-xs text-muted-foreground font-normal">{crypto.name}</span>}
                            </td>
                            <td className="text-right px-3 py-3 font-mono">{fmt(crypto.price)}</td>
                            <td className="text-right px-3 py-3"><Change value={crypto.change24h} /></td>
                            <td className="text-right px-3 py-3 text-muted-foreground font-mono">{fmt(crypto.volume24h)}</td>
                            <td className="text-right px-3 py-3 text-cyan-400 font-mono">{crypto.marketCap ? fmt(crypto.marketCap) : `${safeFixed(crypto.dominance, 1)}%`}</td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No data available</td></tr>
                      )}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-muted-foreground font-mono mt-2">💡 Click any row to open its chart in Order Flow tab</p>
                </div>
              )}
            </div>

            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">CRYPTO MARKET HEATMAP</h4>
              <CryptoHeatmapWidget height={420} />
            </div>

            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">WHALE TRACKER</h4>
              <div className="space-y-2">
                <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                  <div className="text-xs font-mono text-red-400">⬇ Large Sell: 2,500 BTC{btc?.price ? ` (~${fmt(2500 * btc.price)})` : ''}</div>
                  <div className="text-xs text-muted-foreground mt-1">Moved from exchange wallet · 2h ago</div>
                </div>
                <div className="p-3 rounded bg-green-500/10 border border-green-500/30">
                  <div className="text-xs font-mono text-green-400">⬆ Large Buy: 1,800 BTC{btc?.price ? ` (~${fmt(1800 * btc.price)})` : ''}</div>
                  <div className="text-xs text-muted-foreground mt-1">Accumulated at $41,200 · 4h ago</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────── FLOW TAB ─────────────────── */}
        {activeSubTab === 'flow' && (
          <div className="space-y-6">
            <div className="glass-panel px-5 py-4 flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Symbol</span>
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(TV_SYMBOL_MAP).map(([sym, tvSym]) => (
                    <button key={sym} onClick={() => setSelectedSymbol(tvSym)} className={selBtn(selectedSymbol === tvSym)}>{sym}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Interval</span>
                <div className="flex gap-1.5">
                  {INTERVALS.map(({ label, value }) => (
                    <button key={value} onClick={() => setSelectedInterval(value)} className={selBtn(selectedInterval === value)}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel overflow-hidden p-0">
              <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
                <h4 className="text-sm font-bold text-primary">ORDER FLOW & CUMULATIVE VOLUME DELTA</h4>
                <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />LIVE
                  </span>
                  <span className="text-primary font-bold">{activeSymbolLabel}</span>
                  <span>·</span>
                  <span>{INTERVALS.find(i => i.value === selectedInterval)?.label}</span>
                </div>
              </div>
              <TradingViewChart symbol={selectedSymbol} interval={selectedInterval} height={560} />
            </div>

            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4 flex items-center">TOP MOVERS (24H) <SourceBadge source={source} /></h4>
              {loading ? <Skeleton rows={5} /> : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-green-400 font-mono mb-2">▲ GAINERS</div>
                    <div className="space-y-2">
                      {[...cryptos].filter(c => (c.change24h ?? 0) > 0).sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0)).slice(0, 5).map(c => {
                        const tvSym = TV_SYMBOL_MAP[c.symbol?.toUpperCase()] ?? `BINANCE:${c.symbol?.toUpperCase()}USDT`;
                        const isActive = selectedSymbol === tvSym;
                        return (
                          <div key={c.symbol} onClick={() => setSelectedSymbol(tvSym)}
                            className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-all ${isActive ? 'bg-green-500/15 border-green-400/60' : 'bg-green-500/5 border-green-500/20 hover:border-green-500/50'}`}>
                            <span className={`text-xs font-mono font-bold ${isActive ? 'text-green-300' : 'text-foreground'}`}>{c.symbol?.toUpperCase()}</span>
                            <Change value={c.change24h} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-red-400 font-mono mb-2">▼ LOSERS</div>
                    <div className="space-y-2">
                      {[...cryptos].filter(c => (c.change24h ?? 0) < 0).sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0)).slice(0, 5).map(c => {
                        const tvSym = TV_SYMBOL_MAP[c.symbol?.toUpperCase()] ?? `BINANCE:${c.symbol?.toUpperCase()}USDT`;
                        const isActive = selectedSymbol === tvSym;
                        return (
                          <div key={c.symbol} onClick={() => setSelectedSymbol(tvSym)}
                            className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-all ${isActive ? 'bg-red-500/15 border-red-400/60' : 'bg-red-500/5 border-red-500/20 hover:border-red-500/50'}`}>
                            <span className={`text-xs font-mono font-bold ${isActive ? 'text-red-300' : 'text-foreground'}`}>{c.symbol?.toUpperCase()}</span>
                            <Change value={c.change24h} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">BTC ETF TRACKER</h4>
              <div className="space-y-3">
                {[
                  { ticker: 'IBIT', name: 'iShares Bitcoin ETF',     issuer: 'BlackRock'  },
                  { ticker: 'FBTC', name: 'Fidelity Bitcoin ETF',    issuer: 'Fidelity'   },
                  { ticker: 'ARKB', name: 'ARK 21Shares ETF',        issuer: 'ARK Invest' },
                  { ticker: 'GBTC', name: 'Grayscale Bitcoin Trust', issuer: 'Grayscale'  },
                ].map(etf => (
                  <div key={etf.ticker} className="flex items-center justify-between p-3 rounded bg-card/50 border border-border/30">
                    <div>
                      <div className="text-sm font-mono text-foreground font-bold">{etf.ticker}</div>
                      <div className="text-xs text-muted-foreground">{etf.name} · {etf.issuer}</div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">Requires Polygon.io / Alpha Vantage premium</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────── CMP TAB ─────────────────── */}
        {activeSubTab === 'cmp' && (
          <CMPTab
            cryptos={cryptos}
            summary={summary}
            source={source}
            loading={loading}
          />
        )}
        {activeSubTab === 'spot' && (
         <SpotMarket
  cryptos={cryptos}
  summary={summary}
  source={source}
  loading={loading}
/>
        )}
        {activeSubTab === 'derivatives' && (
  <DerivativesMarket />
)}
{activeSubTab === 'CryptoCount' && (
  <CryptoCountTab />
)}
{activeSubTab === 'bitcoinTreasury' && (
  <BitcoinTreasuriesTab  />
)}
      </div>
    </div>
  );
}