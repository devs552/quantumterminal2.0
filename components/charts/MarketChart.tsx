'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartPoint } from '@/lib/types';

interface MarketChartProps {
  data: ChartPoint[];
  title?: string;
  height?: number;
  showArea?: boolean;
  showLegend?: boolean;
  color?: string;
  strokeWidth?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F1432]/90 border border-[#00D9FF]/40 rounded p-2 text-xs">
        <p className="text-[#00D9FF] font-mono">
          {typeof label === 'number'
            ? new Date(label * 1000).toLocaleTimeString()
            : label}
        </p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="font-mono">
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function MarketChart({
  data,
  title,
  height = 300,
  showArea = false,
  showLegend = true,
  color = '#00D9FF',
  strokeWidth = 2,
}: MarketChartProps) {
  const ChartComponent = showArea ? AreaChart : LineChart;

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
          <ChartComponent
            data={data}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#00D9FF"
              strokeOpacity={0.1}
            />
            <XAxis
              dataKey="time"
              stroke="#7A8391"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#7A8391" style={{ fontSize: '12px' }} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend stroke="#B0B9C1" />}
            {showArea ? (
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill="url(#colorGradient)"
                strokeWidth={strokeWidth}
                name="Price"
              />
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={strokeWidth}
                dot={false}
                name="Price"
                isAnimationActive={true}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// OHLC Chart Component for candlestick-style data
export function OHLCChart({
  data,
  title,
  height = 300,
}: {
  data: ChartPoint[];
  title?: string;
  height?: number;
}) {
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
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="ohlcGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0FFF50" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#0FFF50" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#00D9FF"
              strokeOpacity={0.1}
            />
            <XAxis
              dataKey="time"
              stroke="#7A8391"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#7A8391" style={{ fontSize: '12px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="high"
              stackId="1"
              stroke="#0FFF50"
              fill="url(#ohlcGradient)"
              strokeWidth={2}
              name="High"
            />
            <Area
              type="monotone"
              dataKey="low"
              stackId="2"
              stroke="#FF1744"
              fill="#FF1744"
              fillOpacity={0.1}
              strokeWidth={1}
              name="Low"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
