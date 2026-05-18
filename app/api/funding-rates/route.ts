import { NextResponse } from "next/server";

export const revalidate = 60; // 1-minute cache

// ── Binance public endpoints (no API key needed) ───────────────────────────────
const BINANCE_PREMIUM = "https://fapi.binance.com/fapi/v1/premiumIndex";
const BINANCE_OI      = "https://fapi.binance.com/fapi/v1/openInterest";

// Fallback: Bybit public funding rates
const BYBIT_TICKERS = "https://api.bybit.com/v5/market/tickers?category=linear";

// CoinGecko for market cap data
const CG_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false";

// ── Types ──────────────────────────────────────────────────────────────────────
interface BinancePremium {
  symbol: string;
  markPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  interestRate: string;
}

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  market_cap: number;
  current_price: number;
}

interface FundingEntry {
  symbol: string;
  baseAsset: string;
  name: string;
  image: string;
  price: number;
  marketCap: number;
  openInterest: number;
  avgFundingRate: number;   // average across exchanges (Binance primary)
  binanceRate: number | null;
  bybitRate: number | null;
  okxRate: number | null;
  gateRate: number | null;
  nextFundingTime: number;
}

// ── Parse symbol: "BTCUSDT" → "BTC" ───────────────────────────────────────────
function parseBase(symbol: string): string {
  return symbol.replace(/USDT$|BUSD$|USDC$/, "");
}

// ── Fetch Bybit funding rates ──────────────────────────────────────────────────
async function fetchBybitRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch(BYBIT_TICKERS, { next: { revalidate: 60 } });
    if (!res.ok) return {};
    const json = await res.json();
    const out: Record<string, number> = {};
    for (const item of json.result?.list ?? []) {
      if (item.symbol?.endsWith("USDT") && item.fundingRate) {
        const base = parseBase(item.symbol);
        out[base] = parseFloat(item.fundingRate) * 100;
      }
    }
    return out;
  } catch { return {}; }
}

// ── Fetch OKX funding rates (public) ─────────────────────────────────────────
async function fetchOkxRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      "https://www.okx.com/api/v5/public/funding-rate?instType=SWAP",
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return {};
    const json = await res.json();
    const out: Record<string, number> = {};
    for (const item of json.data ?? []) {
      if (item.instId?.endsWith("-USDT-SWAP") && item.fundingRate) {
        const base = item.instId.replace("-USDT-SWAP", "");
        out[base] = parseFloat(item.fundingRate) * 100;
      }
    }
    return out;
  } catch { return {}; }
}

// ── Fetch Gate.io funding rates (public) ──────────────────────────────────────
async function fetchGateRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      "https://api.gateio.ws/api/v4/futures/usdt/contracts",
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return {};
    const json: { name: string; funding_rate: string }[] = await res.json();
    const out: Record<string, number> = {};
    for (const item of json) {
      if (item.name?.endsWith("_USDT") && item.funding_rate) {
        const base = item.name.replace("_USDT", "");
        out[base] = parseFloat(item.funding_rate) * 100;
      }
    }
    return out;
  } catch { return {}; }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET() {
  try {
    // Parallel fetches
    const [binanceRes, cgRes, bybitRates, okxRates, gateRates] = await Promise.allSettled([
      fetch(BINANCE_PREMIUM, { next: { revalidate: 60 } }),
      fetch(CG_MARKETS, { headers: { Accept: "application/json" }, next: { revalidate: 300 } }),
      fetchBybitRates(),
      fetchOkxRates(),
      fetchGateRates(),
    ]);

    // ── Binance premium index ───────────────────────────────────────────────
    if (binanceRes.status === "rejected" || !binanceRes.value.ok) {
      throw new Error("Failed to fetch Binance premium index");
    }
    const binanceData: BinancePremium[] = await binanceRes.value.json();

    // Filter to USDT-margined perpetual contracts only
    const binanceMap: Record<string, { rate: number; nextFunding: number; price: number }> = {};
    for (const item of binanceData) {
      if (!item.symbol.endsWith("USDT")) continue;
      const base = parseBase(item.symbol);
      const rate = parseFloat(item.lastFundingRate) * 100; // convert to %
      binanceMap[base] = {
        rate,
        nextFunding: item.nextFundingTime,
        price: parseFloat(item.markPrice),
      };
    }

    // ── CoinGecko market caps ──────────────────────────────────────────────
    const cgMap: Record<string, { name: string; image: string; marketCap: number; price: number }> = {};
    if (cgRes.status === "fulfilled" && cgRes.value.ok) {
      const cgData: CoinGeckoMarket[] = await cgRes.value.json();
      for (const coin of cgData) {
        cgMap[coin.symbol.toUpperCase()] = {
          name:      coin.name,
          image:     coin.image,
          marketCap: coin.market_cap,
          price:     coin.current_price,
        };
      }
    }

    // ── Exchange rate maps ─────────────────────────────────────────────────
    const bybit = bybitRates.status === "fulfilled" ? bybitRates.value : {};
    const okx   = okxRates.status   === "fulfilled" ? okxRates.value   : {};
    const gate  = gateRates.status  === "fulfilled" ? gateRates.value  : {};

    // ── Build unified funding entry list ───────────────────────────────────
    const entries: FundingEntry[] = [];

    for (const [base, bin] of Object.entries(binanceMap)) {
      const cg = cgMap[base];
      if (!cg && !cgMap[base]) continue; // skip unknown tokens

      const rates = [
        bin.rate,
        bybit[base] ?? null,
        okx[base]   ?? null,
        gate[base]  ?? null,
      ].filter(r => r !== null) as number[];

      const avgRate = rates.length > 0
        ? rates.reduce((a, b) => a + b, 0) / rates.length
        : bin.rate;

      entries.push({
        symbol:         base + "USDT",
        baseAsset:      base,
        name:           cg?.name  ?? base,
        image:          cg?.image ?? "",
        price:          cg?.price ?? bin.price,
        marketCap:      cg?.marketCap ?? 0,
        openInterest:   0, // populated separately if needed
        avgFundingRate: avgRate,
        binanceRate:    bin.rate,
        bybitRate:      bybit[base] ?? null,
        okxRate:        okx[base]   ?? null,
        gateRate:       gate[base]  ?? null,
        nextFundingTime: bin.nextFunding,
      });
    }

    // Sort by market cap descending
    entries.sort((a, b) => b.marketCap - a.marketCap);

    // ── Average funding rate (market-wide) ─────────────────────────────────
    const allRates = entries.map(e => e.avgFundingRate).filter(r => isFinite(r));
    const avgFundingRate = allRates.length > 0
      ? allRates.reduce((a, b) => a + b, 0) / allRates.length
      : 0;

    // ── Highest / Lowest (top 5 each) by absolute Binance rate ────────────
    const withRate = entries.filter(e => e.binanceRate !== null);
    const sortedByRate = [...withRate].sort(
      (a, b) => (b.binanceRate ?? 0) - (a.binanceRate ?? 0)
    );
    const highest = sortedByRate.slice(0, 5).map(e => ({
      coin:     e.baseAsset,
      name:     e.name,
      exchange: "Binance",
      rate:     e.binanceRate!,
    }));
    const lowest = [...sortedByRate].reverse().slice(0, 5).map(e => ({
      coin:     e.baseAsset,
      name:     e.name,
      exchange: "Binance",
      rate:     e.binanceRate!,
    }));

    // ── Heatmap data (needs market cap for X-axis) ─────────────────────────
    const heatmap = entries
      .filter(e => e.marketCap > 0 && e.binanceRate !== null)
      .slice(0, 80)
      .map(e => ({
        symbol:     e.baseAsset,
        name:       e.name,
        image:      e.image,
        marketCap:  e.marketCap,
        price:      e.price,
        openInterest: e.openInterest,
        rate:       e.binanceRate!,
        avgRate:    e.avgFundingRate,
      }));

    // ── Table (top 50 by market cap) ──────────────────────────────────────
    const tableRows = entries.slice(0, 50).map((e, i) => ({
      rank:           i + 1,
      symbol:         e.baseAsset,
      name:           e.name,
      image:          e.image,
      price:          e.price,
      marketCap:      e.marketCap,
      binanceRate:    e.binanceRate,
      bybitRate:      e.bybitRate,
      okxRate:        e.okxRate,
      gateRate:       e.gateRate,
      avgRate:        e.avgFundingRate,
      nextFundingTime: e.nextFundingTime,
    }));

    return NextResponse.json({
      success: true,
      avgFundingRate,
      longsPayShorts: avgFundingRate > 0,
      highest,
      lowest,
      heatmap,
      tableRows,
      totalCoins: entries.length,
      source: "Binance Futures + Bybit + OKX + Gate.io (public APIs)",
      updatedAt: Date.now(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[funding-rates]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}