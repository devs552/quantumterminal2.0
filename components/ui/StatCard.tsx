'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  symbol: string;
  value: number;
  change: number;
  trend: 'up' | 'down';
}

export function StatCard({ symbol, value, change, trend }: StatCardProps) {
  return (
    <div className="glass-panel p-4 hover:border-primary/50 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-mono font-bold text-primary">{symbol}</span>
        {trend === 'up' ? (
          <TrendingUp className="h-4 w-4 text-green-400" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-400" />
        )}
      </div>

      <div className="mb-2">
        <div className="text-xl font-bold text-foreground">
          {symbol === 'SPX' || symbol === 'NDX' || symbol === 'GOLD' || symbol === 'CL'
            ? value.toFixed(2)
            : symbol === 'DXY' || symbol === 'VIX'
              ? value.toFixed(2)
              : value > 100
                ? value.toFixed(2)
                : value.toFixed(2)}
        </div>
      </div>

      <div className={`text-sm font-mono ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
        {change > 0 ? '+' : ''}{change.toFixed(2)}%
      </div>

      <div className="mt-2 w-full h-1 rounded bg-card/50 overflow-hidden">
        <div
          className={`h-full ${change > 0 ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
          style={{ width: `${Math.min(Math.abs(change) * 10, 100)}%` }}
        ></div>
      </div>
    </div>
  );
}
