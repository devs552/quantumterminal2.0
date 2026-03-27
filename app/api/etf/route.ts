import { NextResponse } from 'next/server';

// Types
interface ETFFlowEntry {
  date: string;
  btc: number;
  eth: number;
}

interface OIPoint  { timestamp: number; futures: number; perpetuals: number; marketCap: number }
interface IVPoint  { timestamp: number; btc: number; eth: number; marketCap: number }

interface DerivativesData {
  openInterest: {
    futures: number;
    perpetuals: number;
    total: number;
    historical: {
      yesterday: { futures: number; perpetuals: number };
      lastWeek:  { futures: number; perpetuals: number };
      lastMonth: { futures: number; perpetuals: number };
    };
    yearlyPerformance: {
      high: number; highDate: string;
      low: number;  lowDate: string;
    };
  };
  derivativesVolume: { perpetuals: number; futures: number; total: number };
  impliedVolatility: { btc: number; eth: number; btcChange: number; ethChange: number };
  cexDexSplit:       { cexVol: number; dexVol: number; cexPct: number; dexPct: number };
  etfFlows: ETFFlowEntry[];
  chartData: {
    openInterest: OIPoint[];
    volume:       OIPoint[];
    volatility:   IVPoint[];
  };
}

// Typed time-series generators
function makeOISeries(days: number, base: { futures: number; perpetuals: number; marketCap: number }): OIPoint[] {
  const now = Date.now();
  return Array.from({ length: days + 1 }, (_, i) => {
    const n = () => 0.85 + Math.random() * 0.3;
    return { timestamp: now - (days - i) * 86400000, futures: base.futures * n(), perpetuals: base.perpetuals * n(), marketCap: base.marketCap * n() };
  });
}

function makeIVSeries(days: number, base: { btc: number; eth: number; marketCap: number }): IVPoint[] {
  const now = Date.now();
  return Array.from({ length: days + 1 }, (_, i) => {
    const n = () => 0.85 + Math.random() * 0.3;
    return { timestamp: now - (days - i) * 86400000, btc: base.btc * n(), eth: base.eth * n(), marketCap: base.marketCap * n() };
  });
}

async function fetchCoinGlassDerivatives(): Promise<DerivativesData | null> {
  try {
    const res = await fetch('https://open-api.coinglass.com/public/v2/open_interest', { next: { revalidate: 300 }, headers: { 'coinglassSecret': '' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.data) return data.data as DerivativesData;
  } catch {}
  return null;
}

function getMockData(): DerivativesData {
  const etfFlows: ETFFlowEntry[] = [
    { date: '1 Feb',    btc:  320e6,  eth:  80e6 },
    { date: '3 Feb',    btc: -180e6,  eth: -40e6 },
    { date: '5 Feb',    btc:  450e6,  eth: 120e6 },
    { date: '6 Feb',    btc: -220e6,  eth: -60e6 },
    { date: '7 Feb',    btc: -800e6,  eth: -200e6 },
    { date: '10 Feb',   btc:  200e6,  eth:  50e6 },
    { date: '12 Feb',   btc: -150e6,  eth: -30e6 },
    { date: '13 Feb',   btc:  350e6,  eth:  90e6 },
    { date: '14 Feb',   btc: -400e6,  eth: -100e6 },
    { date: '17 Feb',   btc:  600e6,  eth: 150e6 },
    { date: '18 Feb',   btc: -250e6,  eth: -70e6 },
    { date: '20 Feb',   btc: -100e6,  eth: -20e6 },
    { date: '21 Feb',   btc:  780e6,  eth: 190e6 },
    { date: '24 Feb',   btc:  480e6,  eth: 110e6 },
    { date: '25 Feb',   btc: -120e6,  eth: -30e6 },
    { date: '26 Feb',   btc:  -70e6,  eth: -15e6 },
    { date: '7 March',  btc:  140e6,  eth:  35e6 },
    { date: '28 March', btc:  -70e6,  eth: -18e6 },
  ];

  return {
    openInterest: {
      futures: 3.15e9, perpetuals: 390e9, total: 412.76e9,
      historical: {
        yesterday: { futures: 3.08e9, perpetuals: 388e9 },
        lastWeek:  { futures: 3.22e9, perpetuals: 395e9 },
        lastMonth: { futures: 2.98e9, perpetuals: 375e9 },
      },
      yearlyPerformance: { high: 477e9, highDate: 'Nov 2024', low: 219e9, lowDate: 'Aug 2024' },
    },
    derivativesVolume: { perpetuals: 1.123e12, futures: 453e6, total: 1.576e12 },
    impliedVolatility: { btc: 56.70, eth: 76.60, btcChange: -2.3, ethChange: 1.8 },
    cexDexSplit:       { cexVol: 240e9, dexVol: 6.9e9, cexPct: 97.04, dexPct: 2.96 },
    etfFlows,
    chartData: {
      openInterest: makeOISeries(30, { futures: 3.15e9,  perpetuals: 390e9,    marketCap: 2.36e12 }),
      volume:       makeOISeries(30, { futures: 453e6,   perpetuals: 1.123e12, marketCap: 2.36e12 }),
      volatility:   makeIVSeries(30, { btc: 56.7, eth: 76.6, marketCap: 2.36e12 }),
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'all';
  const liveData = await fetchCoinGlassDerivatives();
  const data = liveData ?? getMockData();
  const source = liveData ? 'coinglass' : 'mock';

  if (type === 'etf-flows') {
    return NextResponse.json({ success: true, data: { flows: data.etfFlows, source }, timestamp: new Date().toISOString() });
  }
  return NextResponse.json({ success: true, data: { ...data, source }, timestamp: new Date().toISOString() });
}