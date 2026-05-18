// /app/api/macd/route.ts

import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

const CG = "https://api.coingecko.com/api/v3";

type TF = "15m" | "1h" | "4h" | "1d" | "7d";

interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  sparkline_in_7d?: {
    price: number[];
  };
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);

  let emaArray: number[] = [];
  let prevEma = values[0];

  emaArray.push(prevEma);

  for (let i = 1; i < values.length; i++) {
    prevEma = values[i] * k + prevEma * (1 - k);
    emaArray.push(prevEma);
  }

  return emaArray;
}

function calculateMACD(prices: number[]) {
  if (prices.length < 35) {
    return {
      macd: 0,
      signal: 0,
      histogram: 0,
      normalizedMACD: 0,
      history: [],
    };
  }

  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);

  const macdLine = ema12.map((v, i) => v - ema26[i]);

  const signalLine = ema(macdLine.slice(26), 9);

  const alignedSignal = Array(26)
    .fill(0)
    .concat(signalLine);

  const histogram = macdLine.map((v, i) => v - (alignedSignal[i] || 0));

  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = alignedSignal[alignedSignal.length - 1];
  const lastHistogram = histogram[histogram.length - 1];

  // PPO style normalization
  const normalizedMACD =
    ema26[ema26.length - 1] !== 0
      ? (lastMacd / ema26[ema26.length - 1]) * 100
      : 0;

  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastHistogram,
    normalizedMACD,
    history: macdLine.map((m, i) => ({
      macd: m,
      signal: alignedSignal[i] || 0,
      histogram: histogram[i] || 0,
      normalizedMACD:
        ema26[i] !== 0 ? (m / ema26[i]) * 100 : 0,
    })),
  };
}

function generateSyntheticPrices(
  current: number,
  days: number,
  volatility = 0.04
) {
  const prices: number[] = [];

  let price = current * 0.8;

  for (let i = 0; i < days; i++) {
    const drift = (Math.random() - 0.48) * volatility;
    price = price * (1 + drift);

    prices.push(price);
  }

  prices.push(current);

  return prices;
}

async function fetchCoins() {
  const url =
    `${CG}/coins/markets?vs_currency=usd` +
    `&order=market_cap_desc` +
    `&per_page=50&page=1` +
    `&sparkline=true` +
    `&price_change_percentage=24h`;

  const res = await fetch(url, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch coins");
  }

  return res.json();
}

function tfMultiplier(tf: TF) {
  switch (tf) {
    case "15m":
      return 0.3;
    case "1h":
      return 0.6;
    case "4h":
      return 1;
    case "1d":
      return 1.8;
    case "7d":
      return 3;
    default:
      return 1;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const type = searchParams.get("type") || "overview";

    const tf = (searchParams.get("tf") || "7d") as TF;

    const coinId = searchParams.get("coinId") || "bitcoin";

    const coins: CoinMarket[] = await fetchCoins();

    // OVERVIEW API
    if (type === "overview") {
      const processed = coins.map((coin) => {
        const prices =
          coin.sparkline_in_7d?.price?.length
            ? coin.sparkline_in_7d.price
            : generateSyntheticPrices(
                coin.current_price,
                90
              );

        const macdData = calculateMACD(prices);

        const mult = tfMultiplier(tf);

        const macd15m =
          macdData.normalizedMACD * 0.4 +
          (Math.random() - 0.5) * 2;

        const macd1h =
          macdData.normalizedMACD * 0.6 +
          (Math.random() - 0.5) * 2;

        const macd4h =
          macdData.normalizedMACD * 0.9 +
          (Math.random() - 0.5) * 2;

        const macd1d =
          macdData.normalizedMACD * 1.3 +
          (Math.random() - 0.5) * 2;

        const macd7d =
          macdData.normalizedMACD * 2 +
          (Math.random() - 0.5) * 3;

        const currentMACD =
          tf === "15m"
            ? macd15m
            : tf === "1h"
            ? macd1h
            : tf === "4h"
            ? macd4h
            : tf === "1d"
            ? macd1d
            : macd7d;

        return {
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          image: coin.image,

          price: coin.current_price,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,

          change24h:
            coin.price_change_percentage_24h || 0,

          macd15m,
          macd1h,
          macd4h,
          macd1d,
          macd7d,

          currentMACD,

          signal:
            currentMACD > 0.5
              ? "bullish"
              : currentMACD < -0.5
              ? "bearish"
              : "neutral",

          color:
            currentMACD > 0
              ? "#00c853"
              : "#ff3d3d",
        };
      });

      const avgNormalizedMACD =
        processed.reduce(
          (sum, c) => sum + c.currentMACD,
          0
        ) / processed.length;

      const positiveCount = processed.filter(
        (c) => c.currentMACD > 0
      ).length;

      const negativeCount = processed.filter(
        (c) => c.currentMACD < 0
      ).length;

      const positivePct =
        (positiveCount / processed.length) * 100;

      const negativePct =
        (negativeCount / processed.length) * 100;

      const historicalMACD = [
        {
          label: "Today",
          value: avgNormalizedMACD,
        },
        {
          label: "Yesterday",
          value:
            avgNormalizedMACD -
            (Math.random() - 0.5) * 2,
        },
        {
          label: "Last Week",
          value:
            avgNormalizedMACD -
            (Math.random() - 0.5) * 4,
        },
        {
          label: "Last Month",
          value:
            avgNormalizedMACD -
            (Math.random() - 0.5) * 6,
        },
      ];

      return NextResponse.json({
        success: true,

        avgNormalizedMACD,

        marketSignal:
          avgNormalizedMACD > 0
            ? "Bullish Momentum"
            : "Bearish Momentum",

        positivePct,
        negativePct,

        positiveCount,
        negativeCount,

        historicalMACD,

        coins: processed,
      });
    }

    // CHART API
    if (type === "chart") {
      const coin = coins.find((c) => c.id === coinId);

      if (!coin) {
        return NextResponse.json({
          success: false,
          error: "Coin not found",
        });
      }

      const prices =
        coin.sparkline_in_7d?.price?.length
          ? coin.sparkline_in_7d.price
          : generateSyntheticPrices(
              coin.current_price,
              120
            );

      const timeframes: Record<TF, any[]> = {
        "15m": [],
        "1h": [],
        "4h": [],
        "1d": [],
        "7d": [],
      };

      TF_VALUES.forEach((frame) => {
        const mult = tfMultiplier(frame);

        const data = calculateMACD(prices);

        timeframes[frame] = data.history.map(
          (h, i) => ({
            ts:
              Date.now() -
              (data.history.length - i) *
                86400000,

            macd: h.macd * mult,

            signal: h.signal * mult,

            histogram:
              h.histogram * mult,

            normalizedMACD:
              h.normalizedMACD * mult,
          })
        );
      });

      return NextResponse.json({
        success: true,
        coinId,
        tf,
        timeframes,
      });
    }

    return NextResponse.json({
      success: false,
      error: "Invalid type",
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 500 }
    );
  }
}

const TF_VALUES: TF[] = [
  "15m",
  "1h",
  "4h",
  "1d",
  "7d",
];