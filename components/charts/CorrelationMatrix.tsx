'use client';

import React from 'react';

interface CorrelationData {
  assets: string[];
  matrix: number[][];
}

interface CorrelationMatrixProps {
  data: CorrelationData;
  title?: string;
}

const getColorForCorrelation = (value: number): string => {
  // Value between -1 and 1
  if (value > 0.5) return '#0FFF50'; // Green for positive
  if (value > 0) return '#B0B9C1'; // Gray for weak positive
  if (value > -0.5) return '#FFB74D'; // Orange for weak negative
  return '#FF1744'; // Red for strong negative
};

const getBackgroundColorForCorrelation = (value: number): string => {
  if (value > 0.5) return '#0FFF5020'; // Green background
  if (value > 0) return '#B0B9C120'; // Gray background
  if (value > -0.5) return '#FFB74D20'; // Orange background
  return '#FF174420'; // Red background
};

export function CorrelationMatrix({
  data,
  title = 'Asset Correlation Matrix',
}: CorrelationMatrixProps) {
  return (
    <div className="w-full space-y-4">
      {title && (
        <div className="font-mono text-sm font-bold text-[#00D9FF]">{title}</div>
      )}

      <div className="bg-[#0A0E27] rounded-lg border border-[#00D9FF]/20 p-4 overflow-x-auto">
        <table className="w-full text-center border-collapse">
          {/* Header Row */}
          <thead>
            <tr>
              <th className="w-20 h-20 border border-[#00D9FF]/10 bg-[#0F1432]/50 text-xs text-[#7A8391] font-mono" />
              {data.assets.map((asset) => (
                <th
                  key={asset}
                  className="min-w-16 h-20 border border-[#00D9FF]/10 bg-[#0F1432]/50 text-xs font-mono text-[#00D9FF] p-2 align-bottom relative"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      style={{
                        transform: 'rotate(-45deg)',
                        transformOrigin: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {asset}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody>
            {data.assets.map((rowAsset, rowIdx) => (
              <tr key={rowAsset}>
                {/* Row Header */}
                <th className="w-20 border border-[#00D9FF]/10 bg-[#0F1432]/50 text-xs font-mono text-[#00D9FF] px-2">
                  {rowAsset}
                </th>

                {/* Data Cells */}
                {data.matrix[rowIdx].map((value, colIdx) => {
                  const color = getColorForCorrelation(value);
                  const bgColor = getBackgroundColorForCorrelation(value);

                  return (
                    <td
                      key={`${rowIdx}-${colIdx}`}
                      className="min-w-16 h-16 border border-[#00D9FF]/10 text-xs font-mono transition-all hover:border-[#00D9FF]/40"
                      style={{ backgroundColor: bgColor }}
                    >
                      <div
                        style={{ color }}
                        className="font-bold flex items-center justify-center h-full"
                      >
                        {value.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#0FFF50]/30 border border-[#0FFF50]" />
          <span className="text-[#7A8391]">Positive (0.5+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#B0B9C1]/30 border border-[#B0B9C1]" />
          <span className="text-[#7A8391]">Weak Positive (0-0.5)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#FFB74D]/30 border border-[#FFB74D]" />
          <span className="text-[#7A8391]">Weak Negative (-0.5-0)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#FF1744]/30 border border-[#FF1744]" />
          <span className="text-[#7A8391]">Negative (-0.5 or less)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate a mock correlation matrix
 */
export function generateCorrelationMatrix(assets: string[]): CorrelationData {
  const n = assets.length;
  const matrix: number[][] = [];

  // Create a symmetric matrix with values between -1 and 1
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0; // Diagonal is always 1
      } else if (i < j) {
        const random = Math.random() * 2 - 1; // Random number between -1 and 1
        matrix[i][j] = random;
        matrix[j][i] = random; // Ensure symmetry
      }
    }
  }

  return { assets, matrix };
}
