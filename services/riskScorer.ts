// services/riskScorer.ts

export interface RiskFactor {
  name: string;
  value: number;   // 0–100
  weight: number;  // relative weight
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface RiskAssessment {
  score: number;
  level: string;
  cascadingRisks: string[];
  recommendations: string[];
}

/**
 * Returns a set of real-time risk factors.
 * In production these would be fetched from live market data feeds.
 */
export function getRealTimeRiskFactors(): RiskFactor[] {
  // Simulate live variance — replace with real feed data
  const jitter = () => Math.random() * 10 - 5;

  return [
    {
      name: 'Volatility Index (VIX)',
      value: Math.min(100, Math.max(0, 55 + jitter())),
      weight: 0.25,
      direction: 'bearish',
    },
    {
      name: 'Yield Curve Spread',
      value: Math.min(100, Math.max(0, 40 + jitter())),
      weight: 0.2,
      direction: 'bearish',
    },
    {
      name: 'Credit Default Swap Spreads',
      value: Math.min(100, Math.max(0, 35 + jitter())),
      weight: 0.2,
      direction: 'neutral',
    },
    {
      name: 'Equity Put/Call Ratio',
      value: Math.min(100, Math.max(0, 60 + jitter())),
      weight: 0.15,
      direction: 'bearish',
    },
    {
      name: 'Dollar Strength (DXY)',
      value: Math.min(100, Math.max(0, 50 + jitter())),
      weight: 0.1,
      direction: 'neutral',
    },
    {
      name: 'Liquidity Conditions',
      value: Math.min(100, Math.max(0, 30 + jitter())),
      weight: 0.1,
      direction: 'bullish',
    },
  ];
}

/**
 * Aggregates risk factors into a single weighted score with qualitative output.
 */
export function calculateRiskScore(factors: RiskFactor[]): RiskAssessment {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedScore = factors.reduce(
    (sum, f) => sum + (f.value * f.weight) / totalWeight,
    0,
  );
  const score = Math.round(weightedScore);

  const level =
    score >= 80 ? 'CRITICAL'
    : score >= 60 ? 'HIGH'
    : score >= 40 ? 'MEDIUM'
    : 'LOW';

  const bearishFactors = factors
    .filter(f => f.direction === 'bearish' && f.value > 50)
    .map(f => `Elevated ${f.name} (${Math.round(f.value)}/100)`);

  const cascadingRisks: string[] =
    bearishFactors.length > 0
      ? bearishFactors
      : ['No material cascading risks detected at current levels'];

  const recommendations: string[] = [];

  if (score >= 80) {
    recommendations.push('Reduce risk exposure immediately — critical threshold breached');
    recommendations.push('Rotate into defensive assets (treasuries, gold, cash)');
    recommendations.push('Hedge tail risk with options or inverse ETFs');
  } else if (score >= 60) {
    recommendations.push('Trim high-beta positions and raise cash buffer');
    recommendations.push('Monitor stop-loss levels closely');
    recommendations.push('Diversify across uncorrelated assets');
  } else if (score >= 40) {
    recommendations.push('Maintain current allocations with cautious optimism');
    recommendations.push('Watch for deterioration in leading indicators');
  } else {
    recommendations.push('Conditions favour risk-on positioning');
    recommendations.push('Consider adding cyclical or growth exposure on dips');
  }

  return { score, level, cascadingRisks, recommendations };
}