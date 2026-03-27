'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from 'recharts';

export interface YieldCurvePoint {
  maturity: string;
  yield: number;
  previousYield?: number;
}

interface YieldCurveProps {
  data: YieldCurvePoint[];
  title?: string;
  showComparison?: boolean;
  height?: number;
}

const YieldCurveTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F1432]/90 border border-[#00D9FF]/40 rounded p-2 text-xs">
        <p className="text-[#00D9FF] font-mono">{payload[0].payload.maturity}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="font-mono">
            {entry.name}: {entry.value?.toFixed(2)}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function YieldCurve({
  data,
  title = 'Yield Curve',
  showComparison = false,
  height = 300,
}: YieldCurveProps) {
  return (
    <div className="w-full">
      {title && (
        <div className="mb-4 font-mono text-sm font-bold text-[#00D9FF]">{title}</div>
      )}
      <div
        className="bg-[#0A0E27] rounded-lg border border-[#00D9FF]/20 p-4"
        style={{ height: `${height}px` }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#00D9FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#00D9FF"
              strokeOpacity={0.1}
            />
            <XAxis
              dataKey="maturity"
              stroke="#7A8391"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#7A8391"
              style={{ fontSize: '12px' }}
              label={{ value: 'Yield (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<YieldCurveTooltip />} />
            <Legend stroke="#B0B9C1" />

            {showComparison && data[0].previousYield !== undefined ? (
              <>
                <Line
                  type="monotone"
                  dataKey="yield"
                  stroke="#00D9FF"
                  strokeWidth={3}
                  dot={{ fill: '#00D9FF', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Current Yield"
                  isAnimationActive={true}
                />
                <Line
                  type="monotone"
                  dataKey="previousYield"
                  stroke="#FFB74D"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Previous Yield"
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="yield"
                stroke="#00D9FF"
                strokeWidth={3}
                dot={{ fill: '#00D9FF', r: 4 }}
                activeDot={{ r: 6 }}
                name="Yield"
                isAnimationActive={true}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Generate mock yield curve data
 */
export function generateYieldCurveData(): YieldCurvePoint[] {
  return [
    { maturity: '1M', yield: 5.2, previousYield: 5.1 },
    { maturity: '3M', yield: 5.35, previousYield: 5.25 },
    { maturity: '6M', yield: 5.45, previousYield: 5.35 },
    { maturity: '1Y', yield: 5.42, previousYield: 5.4 },
    { maturity: '2Y', yield: 4.95, previousYield: 4.9 },
    { maturity: '3Y', yield: 4.65, previousYield: 4.6 },
    { maturity: '5Y', yield: 4.28, previousYield: 4.25 },
    { maturity: '7Y', yield: 4.15, previousYield: 4.12 },
    { maturity: '10Y', yield: 3.95, previousYield: 3.92 },
    { maturity: '20Y', yield: 4.15, previousYield: 4.1 },
    { maturity: '30Y', yield: 4.05, previousYield: 4.0 },
  ];
}

/**
 * Alternative yield curve with inverted status indicator
 */
export function YieldCurveAnalysis({
  data = generateYieldCurveData(),
}: {
  data?: YieldCurvePoint[];
}) {
  const shortTerm = data.slice(0, 4).reduce((sum, d) => sum + d.yield, 0) / 4;
  const longTerm = data.slice(7).reduce((sum, d) => sum + d.yield, 0) / 3;
  const isInverted = shortTerm > longTerm;

  return (
    <div className="space-y-4">
      <YieldCurve data={data} title="US Treasury Yield Curve" showComparison />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0F1432]/50 border border-[#00D9FF]/20 rounded-lg p-4">
          <div className="text-xs text-[#7A8391] font-mono mb-2">SHORT TERM (3M-1Y)</div>
          <div className="text-2xl font-bold font-mono text-[#00D9FF]">
            {shortTerm.toFixed(2)}%
          </div>
        </div>
        <div className="bg-[#0F1432]/50 border border-[#00D9FF]/20 rounded-lg p-4">
          <div className="text-xs text-[#7A8391] font-mono mb-2">LONG TERM (10Y-30Y)</div>
          <div className="text-2xl font-bold font-mono text-[#00D9FF]">
            {longTerm.toFixed(2)}%
          </div>
        </div>
        <div
          className={`rounded-lg p-4 border ${
            isInverted
              ? 'bg-[#FF1744]/10 border-[#FF1744]/40'
              : 'bg-[#0FFF50]/10 border-[#0FFF50]/40'
          }`}
        >
          <div className="text-xs text-[#7A8391] font-mono mb-2">STATUS</div>
          <div
            className={`text-sm font-bold font-mono ${
              isInverted ? 'text-[#FF1744]' : 'text-[#0FFF50]'
            }`}
          >
            {isInverted ? 'INVERTED' : 'NORMAL'}
          </div>
          <div className="text-xs text-[#7A8391] mt-2">
            Spread: {(longTerm - shortTerm).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}
