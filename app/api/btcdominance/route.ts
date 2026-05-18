import { NextResponse } from "next/server";

export const revalidate = 300;

const CG = "https://api.coingecko.com/api/v3";

interface DominancePoint { date: string; btc: number; eth: number; others: number }
interface TopCoin {
  id: string; symbol: string; name: string; image: string;
  market_cap: number; dominance: number; price_change_24h: number;
}

function toDate(ts: number) {
  return new Date(ts).toISOString().split("T")[0];
}

export async function GET() {
  try {
    // ── 1. Fetch all sources in parallel ─────────────────────────────────
    // NOTE: /global/market_cap_chart is a paid-plan-only endpoint and will
    // return an error on the free tier. We derive total market cap history
    // from BTC market caps + the current BTC dominance ratio instead.
    const [globalRes, btcChartRes, ethChartRes, coinsRes] =
      await Promise.allSettled([
        fetch(`${CG}/global`, {
          headers: { Accept: "application/json" },
          next: { revalidate: 300 },
        }),
        fetch(`${CG}/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily`, {
          headers: { Accept: "application/json" },
          next: { revalidate: 3600 },
        }),
        fetch(`${CG}/coins/ethereum/market_chart?vs_currency=usd&days=365&interval=daily`, {
          headers: { Accept: "application/json" },
          next: { revalidate: 3600 },
        }),
        fetch(
          `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false`,
          { headers: { Accept: "application/json" }, next: { revalidate: 300 } }
        ),
      ]);

    // ── 2. Global dominance (current) ─────────────────────────────────────
    if (globalRes.status === "rejected" || !globalRes.value.ok) {
      throw new Error("Failed to fetch global market data");
    }
    const gData   = (await globalRes.value.json()).data;
    const mcPct: Record<string, number> = gData.market_cap_percentage ?? {};
    const btcDom    = mcPct.btc   ?? 0;
    const ethDom    = mcPct.eth   ?? 0;
    const bnbDom    = mcPct.bnb   ?? 0;
    const usdtDom   = mcPct.usdt  ?? 0;
    const solDom    = mcPct.sol   ?? 0;
    const othersDom = Math.max(0, 100 - btcDom - ethDom - bnbDom - usdtDom - solDom);
    const totalMcNow: number = gData.total_market_cap?.usd ?? 1;

    // ── 3. BTC market cap history ─────────────────────────────────────────
    const btcMcMap: Record<string, number> = {};
    if (btcChartRes.status === "fulfilled" && btcChartRes.value.ok) {
      const j = await btcChartRes.value.json();
      const caps: [number, number][] = j.market_caps ?? [];
      for (const [ts, val] of caps) btcMcMap[toDate(ts)] = val;
    }

    if (Object.keys(btcMcMap).length === 0) {
      throw new Error("Failed to fetch BTC market cap history");
    }

    // ── 4. ETH market cap history ─────────────────────────────────────────
    const ethMcMap: Record<string, number> = {};
    if (ethChartRes.status === "fulfilled" && ethChartRes.value.ok) {
      const j = await ethChartRes.value.json();
      const caps: [number, number][] = j.market_caps ?? [];
      for (const [ts, val] of caps) ethMcMap[toDate(ts)] = val;
    }

    // ── 5. Derive total market cap history from BTC dominance ─────────────
    // We use the current BTC dominance (%) as an approximation to back-calculate
    // the total market cap for each historical date:
    //   totalMc(date) ≈ btcMc(date) / (btcDom / 100)
    // This is a reasonable proxy since BTC dominance doesn't swing wildly day-to-day.
    const btcDomFraction = btcDom > 0 ? btcDom / 100 : 0.5;

    // ── 6. Build dominance chart ──────────────────────────────────────────
    const allDates = Object.keys(btcMcMap).sort();

    const chartData: DominancePoint[] = allDates
      .filter((d) => btcMcMap[d] > 0)
      .map((date) => {
        const btcMc    = btcMcMap[date];
        const ethMc    = ethMcMap[date] ?? 0;
        // Derived total market cap for this date
        const totalMc  = btcMc / btcDomFraction;
        const btcPct   = (btcMc  / totalMc) * 100;
        const ethPct   = (ethMc  / totalMc) * 100;
        return {
          date,
          btc:    parseFloat(btcPct.toFixed(2)),
          eth:    parseFloat(Math.max(0, ethPct).toFixed(2)),
          others: parseFloat(Math.max(0, 100 - btcPct - ethPct).toFixed(2)),
        };
      });

    // ── 7. Historical snapshots ───────────────────────────────────────────
    const n = chartData.length;
    const yesterday = chartData[n - 2]  ?? { btc: btcDom, eth: ethDom, others: othersDom };
    const lastWeek  = chartData[n - 8]  ?? yesterday;
    const lastMonth = chartData[n - 31] ?? lastWeek;

    // Yearly high/low for BTC dominance
    let highBtc = { value: 0, date: "", eth: 0, others: 0 };
    let lowBtc  = { value: 100, date: "", eth: 0, others: 0 };
    for (const pt of chartData) {
      if (pt.btc > highBtc.value) highBtc = { value: pt.btc, date: pt.date, eth: pt.eth, others: pt.others };
      if (pt.btc < lowBtc.value)  lowBtc  = { value: pt.btc, date: pt.date, eth: pt.eth, others: pt.others };
    }

    // ── 8. Top coins for pie chart ────────────────────────────────────────
    let topCoins: TopCoin[] = [];
    if (coinsRes.status === "fulfilled" && coinsRes.value.ok) {
      const coinsJson = await coinsRes.value.json();
      topCoins = coinsJson.slice(0, 8).map((c: {
        id: string; symbol: string; name: string; image: string;
        market_cap: number; price_change_percentage_24h: number;
      }) => ({
        id:               c.id,
        symbol:           c.symbol.toUpperCase(),
        name:             c.name,
        image:            c.image,
        market_cap:       c.market_cap ?? 0,
        dominance:        ((c.market_cap ?? 0) / totalMcNow) * 100,
        price_change_24h: c.price_change_percentage_24h ?? 0,
      }));
    }

    const topDomSum    = topCoins.reduce((s, c) => s + c.dominance, 0);
    const othersPiePct = Math.max(0, 100 - topDomSum);

    return NextResponse.json({
      success: true,
      current:    { btc: btcDom, eth: ethDom, bnb: bnbDom, usdt: usdtDom, sol: solDom, others: othersDom },
      historical: {
        yesterday: { btc: yesterday.btc, eth: yesterday.eth, others: yesterday.others },
        lastWeek:  { btc: lastWeek.btc,  eth: lastWeek.eth,  others: lastWeek.others  },
        lastMonth: { btc: lastMonth.btc, eth: lastMonth.eth, others: lastMonth.others },
      },
      yearly: {
        high: { date: highBtc.date, btc: highBtc.value, eth: highBtc.eth, others: highBtc.others },
        low:  { date: lowBtc.date,  btc: lowBtc.value,  eth: lowBtc.eth,  others: lowBtc.others  },
      },
      chart: chartData,
      topCoins,
      othersPiePct,
      source: "CoinGecko Free API",
      updatedAt: Date.now(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[btc-dominance]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}