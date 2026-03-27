import { NextResponse } from 'next/server';

export const revalidate = 300; // Cache 5 minutes

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const BTC_TOTAL_SUPPLY = 21_000_000;

interface CoinGeckoCompany {
  name: string;
  symbol: string;
  country: string;
  total_holdings: number;
  total_entry_value_usd: number;
  total_current_value_usd: number;
  percentage_of_total_supply: number;
}

interface CoinGeckoTreasury {
  total_holdings: number;
  total_value_usd: number;
  market_cap_dominance: number;
  companies: CoinGeckoCompany[];
}

export async function GET() {
  try {
    // Fetch Bitcoin treasuries from CoinGecko (free, no key needed)
    const [treasuryRes, priceRes] = await Promise.all([
      fetch(`${COINGECKO_BASE}/companies/public_treasury/bitcoin`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
      }),
      fetch(`${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      }),
    ]);

    if (!treasuryRes.ok) {
      throw new Error(`CoinGecko treasury endpoint failed: ${treasuryRes.status}`);
    }

    const treasury: CoinGeckoTreasury = await treasuryRes.json();
    const priceJson = priceRes.ok ? await priceRes.json() : null;
    const btcPrice: number = priceJson?.bitcoin?.usd ?? 0;

    const companies = treasury.companies ?? [];

    // --- Countries breakdown ---
    const countryMap: Record<string, number> = {};
    for (const c of companies) {
      const key = c.country || 'Others';
      countryMap[key] = (countryMap[key] ?? 0) + c.total_holdings;
    }

    const totalHeld = treasury.total_holdings || 1;
    // Build sorted countries array
    const countryEntries = Object.entries(countryMap)
      .map(([country, btc]) => ({
        country,
        btc,
        pct: (btc / totalHeld) * 100,
      }))
      .sort((a, b) => b.btc - a.btc);

    // Collapse small countries into "Others"
    const TOP_COUNTRIES = 5;
    const topCountries = countryEntries.slice(0, TOP_COUNTRIES);
    const othersHeld = countryEntries
      .slice(TOP_COUNTRIES)
      .reduce((s, c) => s + c.btc, 0);
    if (othersHeld > 0) {
      topCountries.push({
        country: 'Others',
        btc: othersHeld,
        pct: (othersHeld / totalHeld) * 100,
      });
    }

    // --- Company donut: top 9 + Others ---
    const TOP_COMPANIES = 9;
    const sortedCompanies = [...companies].sort(
      (a, b) => b.total_holdings - a.total_holdings
    );
    const topCompanies = sortedCompanies.slice(0, TOP_COMPANIES);
    const othersHolding = sortedCompanies
      .slice(TOP_COMPANIES)
      .reduce((s, c) => s + c.total_holdings, 0);

    const donutCompanies = topCompanies.map((c) => ({
      name: c.name,
      symbol: c.symbol,
      btc: c.total_holdings,
      pct: (c.total_holdings / totalHeld) * 100,
    }));

    if (othersHolding > 0) {
      donutCompanies.push({
        name: 'Others',
        symbol: '',
        btc: othersHolding,
        pct: (othersHolding / totalHeld) * 100,
      });
    }

    // --- Table data ---
    const tableRows = sortedCompanies.map((c, i) => ({
      rank: i + 1,
      name: c.name,
      ticker: c.symbol?.replace('.US', '').replace('.JP', '').replace('.CA', '') ?? '—',
      country: c.country || '—',
      btcHoldings: c.total_holdings,
      percentSupply: c.percentage_of_total_supply,
      currentValue: c.total_current_value_usd,
      entryValue: c.total_entry_value_usd,
    }));

    return NextResponse.json({
      success: true,
      btcPrice,
      totalHeld: treasury.total_holdings,
      totalSupply: BTC_TOTAL_SUPPLY,
      supplyPct: (treasury.total_holdings / BTC_TOTAL_SUPPLY) * 100,
      totalValueUsd: treasury.total_value_usd,
      marketCapDominance: treasury.market_cap_dominance,
      countries: topCountries,
      donut: donutCompanies,
      table: tableRows,
      updatedAt: Date.now(),
      source: 'CoinGecko API',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('bitcoin-treasury route error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}