import { NextRequest, NextResponse } from 'next/server';
import { fredAPI } from '@/lib/external-apis';
import { generateMacroIndicators } from '@/lib/mock-data-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  const { seriesId } = params;

  try {
    if (process.env.FRED_API_KEY) {
      const data = await fredAPI.getSeries(seriesId, 24);
      if (data && data.length > 0) {
        const observations = data
          .filter((obs: any) => obs.value !== '.' && obs.value !== null)
          .map((obs: any) => ({
            time: obs.date,
            value: parseFloat(obs.value),
          }))
          .reverse(); // oldest → newest for chart

        return NextResponse.json(
          {
            success: true,
            data: {
              seriesId,
              observations,
              source: 'fred',
              timestamp: new Date().toISOString(),
            },
          },
          { headers: { 'Cache-Control': 'public, max-age=3600' } }
        );
      }
    }

    // Fallback: generate plausible mock time-series for the series
    const mockObservations = Array.from({ length: 24 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (23 - i));
      return {
        time: date.toISOString().slice(0, 10),
        value: parseFloat((Math.random() * 5 + 1).toFixed(2)),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        seriesId,
        observations: mockObservations,
        source: 'mock',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`[Macro SeriesId API] Error for ${seriesId}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch series data' },
      { status: 500 }
    );
  }
}