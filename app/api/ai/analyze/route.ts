// app/api/ai-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRealTimeRiskFactors, calculateRiskScore } from '@/services/riskScorer';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TechnicalAnalysis {
  trend: string;
  support: number;
  resistance: number;
  momentum: string;
}

interface Fundamentals {
  sentiment: string;
  news: string;
  macroFactors: string;
}

interface AIInsights {
  prediction: string;
  confidence: number;
  cascadingRisks: string[];
  recommendations: string[];
}

interface AnalysisData {
  summary: string;
  technicalAnalysis: TechnicalAnalysis;
  fundamentals: Fundamentals;
  ai_insights: AIInsights;
  timeframe: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAnalysis(
  asset: string,
  period: string,
  riskScore: number,
  recommendations: string[],
  cascadingRisks: string[],
): AnalysisData {
  // Deterministic-ish values keyed to asset string for stable responses.
  // Replace with real OpenAI / model calls in production.
  const seed = asset.charCodeAt(0) + asset.charCodeAt(asset.length - 1);
  const bullPct = 35 + (seed % 25);           // 35–60 %
  const confidence = 0.55 + (seed % 30) / 100; // 0.55–0.85

  const trend =
    riskScore >= 70 ? 'Bearish' : riskScore >= 45 ? 'Consolidating' : 'Bullish';

  const supportPct  = -1.5 - (seed % 3);   // negative = below current price
  const resistPct   =  1.5 + (seed % 4);   // positive = above current price

  const momentum =
    riskScore >= 70 ? 'Weakening' : riskScore >= 45 ? 'Neutral' : 'Strengthening';

  const sentimentLabel =
    bullPct > 50 ? 'Cautiously Optimistic' : bullPct > 40 ? 'Mixed' : 'Risk-Off';

  return {
    summary: `${asset} is showing ${trend.toLowerCase()} signals in the ${period} window with a risk score of ${riskScore}/100. ${
      riskScore >= 60
        ? 'Macro headwinds and elevated volatility warrant defensive positioning.'
        : 'Conditions remain constructive — watch key support levels for continuation.'
    }`,
    technicalAnalysis: {
      trend,
      support: parseFloat(supportPct.toFixed(1)),
      resistance: parseFloat(resistPct.toFixed(1)),
      momentum,
    },
    fundamentals: {
      sentiment: sentimentLabel,
      news:
        riskScore >= 60
          ? 'Regulatory uncertainty creating headwinds'
          : 'Regulatory clarity improving, institutional flows positive',
      macroFactors:
        riskScore >= 60
          ? 'Fed remains data-dependent; yield curve signals caution'
          : 'Fed pause signals reducing pressure; liquidity conditions easing',
    },
    ai_insights: {
      prediction: `${bullPct}% probability of ${trend.toLowerCase()} continuation over ${period}`,
      confidence: parseFloat(confidence.toFixed(2)),
      cascadingRisks,
      recommendations,
    },
    timeframe: period,
  };
}

// ── POST — full structured analysis ──────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      asset?: string;
      period?: string;
      indicators?: string[];
    };

    const asset  = typeof body.asset  === 'string' && body.asset.trim()  ? body.asset.trim().toUpperCase()  : 'BTC';
    const period = typeof body.period === 'string' && body.period.trim() ? body.period.trim() : '24h';

    const riskFactors    = getRealTimeRiskFactors();
    const riskAssessment = calculateRiskScore(riskFactors);

    const analysis = buildAnalysis(
      asset,
      period,
      riskAssessment.score,
      riskAssessment.recommendations,
      riskAssessment.cascadingRisks,
    );

    return NextResponse.json({
      success: true,
      asset,
      period,
      riskAssessment,
      analysis,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('[ai-analysis POST]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to generate analysis' },
      { status: 500 },
    );
  }
}

// ── GET — streaming token-by-token analysis ───────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const asset = request.nextUrl.searchParams.get('asset') ?? 'BTC';

  const riskFactors    = getRealTimeRiskFactors();
  const riskAssessment = calculateRiskScore(riskFactors);

  const trend =
    riskAssessment.score >= 70 ? 'bearish' :
    riskAssessment.score >= 45 ? 'consolidating' : 'bullish';

  const messages = [
    `Initialising analysis engine for ${asset}...`,
    `Risk score computed: ${riskAssessment.score}/100 — ${riskAssessment.level}`,
    `Market structure: ${trend} — scanning key levels...`,
    `Support detected at ${(-1.5 - (asset.length % 3)).toFixed(1)}% below spot.`,
    `Resistance band: +${(1.5 + (asset.charCodeAt(0) % 4)).toFixed(1)}% above spot.`,
    `Liquidity analysis: ${riskAssessment.score >= 60 ? 'thin order book above resistance' : 'healthy depth on both sides'}.`,
    `Macro overlay: ${riskAssessment.cascadingRisks[0] ?? 'No cascading risks identified'}.`,
    `Confidence interval: ${Math.round((0.55 + (asset.charCodeAt(0) % 30) / 100) * 100)}%`,
    `Primary recommendation: ${riskAssessment.recommendations[0] ?? 'Hold current positions'}.`,
    `Stream complete ✓`,
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const msg of messages) {
        controller.enqueue(encoder.encode(msg + '\n'));
        // Stagger messages to simulate real streaming
        await new Promise<void>(resolve => setTimeout(resolve, 420));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':     'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control':    'no-cache',
      'X-Accel-Buffering': 'no', // disable Nginx proxy buffering if behind one
    },
  });
}