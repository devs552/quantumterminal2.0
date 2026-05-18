/**
 * /api/cmc-index/route.ts
 * Free CMC Index API — no API key required
 * Uses CoinGecko public endpoints + client-side market-cap weighting
 *
 * Query params:
 *   index=20|100        (default: 20)
 *   days=1|7|30|365|max (default: 365)
 *   type=data|history   (default: data)
 */

import { NextResponse } from "next/server";

const CG = "https://api.coingecko.com/api/v3";

const CMC20_IDS = [
  "bitcoin","ethereum","binancecoin","ripple","solana",
  "tron","dogecoin","cardano","bitcoin-cash","hyperliquid",
  "chainlink","avalanche-2","sui","stellar","shiba-inu",
  "litecoin","polkadot","uniswap","near","internet-computer",
];

const CMC100_IDS = [
  ...CMC20_IDS,
  "pepe","wrapped-bitcoin","leo-token","okb","monero",
  "hedera-hashgraph","mantra-dao","cosmos","render-token","bittensor",
  "ethena","jupiter-exchange-solana","filecoin","arbitrum","optimism",
  "the-graph","aave","maker","ondo-finance","floki",
  "stacks","immutable-x","thorchain","notcoin","wormhole",
  "aptos","injective-protocol","sei-network","raydium","bonk",
];

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; cmc-index-bot/1.0)",
};

async function cgFetch(url: string) {
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CoinGecko ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

function computeIndex(coins: any[]) {
  const totalMcap = coins.reduce((s: number, c: any) => s + (c.market_cap || 0), 0);
  return coins.map((c: any, i: number) => ({
    rank: i + 1,
    id: c.id,
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    price: c.current_price,
    change24h: c.price_change_percentage_24h ?? 0,
    marketCap: c.market_cap,
    weight: totalMcap > 0 ? (c.market_cap / totalMcap) * 100 : 0,
    image: c.image,
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const indexSize = searchParams.get("index") === "100" ? 100 : 20;
  const days = searchParams.get("days") || "365";
  const type = searchParams.get("type") || "data";

  try {
    if (type === "history") {
      // Historical index approximation: BTC 70% + ETH 13% (largest constituents)
      const [btc, eth] = await Promise.all([
        cgFetch(`${CG}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`),
        cgFetch(`${CG}/coins/ethereum/market_chart?vs_currency=usd&days=${days}`),
      ]);

      const btcPrices: [number, number][] = btc.prices ?? [];
      const ethPrices: [number, number][] = eth.prices ?? [];
      const len = Math.min(btcPrices.length, ethPrices.length);

      if (len === 0) throw new Error("No price history returned");

      const raw = Array.from({ length: len }, (_, i) => [
        btcPrices[i][0],
        btcPrices[i][1] * 0.70 + ethPrices[i][1] * 0.13,
      ]);

      // Normalise to 100 at start
      const base = raw[0][1];
      const history = raw.map(([ts, v]) => ({
        timestamp: ts,
        date: new Date(ts).toISOString().split("T")[0],
        value: parseFloat(((v / base) * 100).toFixed(4)),
      }));

      return NextResponse.json({
        success: true,
        index: indexSize,
        days,
        count: history.length,
        history,
        note: "Index value is normalised to 100 at the start of the requested period",
      });
    }

    // type === "data" → live market data
    const ids = indexSize === 100 ? CMC100_IDS : CMC20_IDS;

    // CoinGecko free tier: max 250 per call; split into batches of 50
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));

    const results = await Promise.all(
      batches.map(batch =>
        cgFetch(
          `${CG}/coins/markets?vs_currency=usd&ids=${batch.join(",")}&order=market_cap_desc&per_page=50&sparkline=false&price_change_percentage=24h`
        )
      )
    );

    const allCoins = results.flat();
    // Re-sort by market cap (batches may shuffle order)
    allCoins.sort((a: any, b: any) => (b.market_cap || 0) - (a.market_cap || 0));

    const constituents = computeIndex(allCoins);
    const totalMcap = allCoins.reduce((s: number, c: any) => s + (c.market_cap || 0), 0);

    // Weighted index value (market-cap weighted price, normalised)
    const indexValue = constituents.reduce(
      (s, c) => s + (c.weight / 100) * c.price,
      0
    );
    const change24h = constituents.reduce(
      (s, c) => s + (c.weight / 100) * c.change24h,
      0
    );

    return NextResponse.json({
      success: true,
      index: indexSize,
      value: parseFloat(indexValue.toFixed(4)),
      change24h: parseFloat(change24h.toFixed(4)),
      totalMarketCap: totalMcap,
      constituentCount: constituents.length,
      constituents,
      methodology: "Market-cap weighted, recomputed at request time",
      source: "CoinGecko public API",
      updatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cmc-index route error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}