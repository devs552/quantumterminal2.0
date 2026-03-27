'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { SECTORS, COLORS } from '@/lib/constants';

interface HeatmapDataPoint {
  x: string;
  y: string;
  value: number;
  color?: string;
}

interface SectorHeatmapProps {
  data: HeatmapDataPoint[];
  title?: string;
  height?: number;
}

export function SectorHeatmap({
  data,
  title = 'Sector Performance Heatmap',
  height = 400,
}: SectorHeatmapProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    // Get unique x and y values
    const xAxis = Array.from(new Set(data.map(d => d.x)));
    const yAxis = Array.from(new Set(data.map(d => d.y)));

    // Transform data for ECharts
    const transformedData = data.map(d => [
      xAxis.indexOf(d.x),
      yAxis.indexOf(d.y),
      d.value,
    ]);

    // Calculate min and max for color scaling
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const option: echarts.EChartsOption = {
      title: {
        text: title,
        left: 'center',
        top: 'top',
        textStyle: {
          color: COLORS.primary,
          fontSize: 14,
          fontFamily: 'monospace',
        },
      },
      tooltip: {
        position: 'top',
        backgroundColor: `${COLORS.surface}E0`,
        borderColor: COLORS.primary,
        textStyle: {
          color: COLORS.textPrimary,
          fontFamily: 'monospace',
        },
        formatter: (params: any) => {
          if (params.componentSubType === 'heatmap') {
            const dataIndex = params.dataIndex;
            const d = data[dataIndex];
            return `${d.x} - ${d.y}<br/>Value: ${d.value.toFixed(2)}`;
          }
          return '';
        },
      },
      grid: {
        top: 80,
        height: height - 120,
        left: 150,
        right: 50,
      },
      xAxis: {
        type: 'category',
        data: xAxis,
        splitArea: {
          show: true,
          areaStyle: {
            color: [`${COLORS.primary}10`],
          },
        },
        axisLabel: {
          color: COLORS.textSecondary,
          fontFamily: 'monospace',
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'category',
        data: yAxis,
        splitArea: {
          show: true,
          areaStyle: {
            color: [`${COLORS.primary}10`],
          },
        },
        axisLabel: {
          color: COLORS.textSecondary,
          fontFamily: 'monospace',
          fontSize: 11,
        },
      },
      visualMap: {
        min: minValue,
        max: maxValue,
        calculable: true,
        orient: 'vertical',
        right: '2%',
        top: 'center',
        inRange: {
          color: ['#0FFF50', '#FFD700', '#FF1744'],
        },
        textStyle: {
          color: COLORS.textSecondary,
        },
      },
      series: [
        {
          name: 'Performance',
          type: 'heatmap',
          data: transformedData,
          emphasis: {
            itemStyle: {
              borderColor: COLORS.primary,
              borderWidth: 2,
            },
          },
          itemStyle: {
            opacity: 0.8,
          },
          animationDuration: 300,
        },
      ],
    };

    chartInstance.current.setOption(option);

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, title, height]);

  return (
    <div className="w-full">
      <div
        ref={chartRef}
        className="bg-[#0A0E27] rounded-lg border border-[#00D9FF]/20"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}

// Animated sector grid component
export function SectorGrid({
  data,
  title = 'Sector Performance',
}: {
  data: HeatmapDataPoint[];
  title?: string;
}) {
  return (
    <div className="w-full space-y-4">
      {title && (
        <div className="font-mono text-sm font-bold text-[#00D9FF]">{title}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECTORS.map((sector) => {
          const sectorData = data.filter(d => d.x === sector || d.y === sector);
          const avgValue =
            sectorData.length > 0
              ? sectorData.reduce((sum, d) => sum + d.value, 0) / sectorData.length
              : 50;

          const isPositive = avgValue > 50;
          const color = isPositive ? '#0FFF50' : '#FF1744';

          return (
            <div
              key={sector}
              className="bg-[#0F1432]/50 border border-[#00D9FF]/20 rounded-lg p-4 hover:border-[#00D9FF]/40 transition-all"
            >
              <div className="flex items-between justify-between mb-2">
                <span className="text-sm font-mono text-[#B0B9C1]">{sector}</span>
                <span className="text-xs font-mono px-2 py-1 rounded" style={{ color }}>
                  {isPositive ? '+' : ''}{avgValue.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-[#0A0E27] rounded-full h-2 overflow-hidden border border-[#00D9FF]/10">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(avgValue, 100)}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}80)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
