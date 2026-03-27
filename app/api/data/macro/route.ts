import { NextRequest, NextResponse } from 'next/server';
import { generateMacroIndicators } from '@/lib/mock-data-generator';
import { fredAPI, transformFREDtoMacro } from '@/lib/external-apis';
import { MACRO_INDICATORS } from '@/lib/constants';

/**
 * GET /api/data/macro
 * Returns macro economic indicators from FRED with fallback to mock data
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const useRealData = searchParams.get('real') !== 'false';

    // Try to fetch real data from FRED
    if (useRealData) {
      const realData = await fetchRealMacroData();
      console.log("is real data",realData)
      if (realData && realData.length > 0) {
        return NextResponse.json(
          {
            success: true,
            data: {
              indicators: realData,
              timestamp: new Date().toISOString(),
              source: 'fred',
            },
            timestamp: new Date().toISOString(),
          },
          { headers: { 'Cache-Control': 'public, max-age=3600' } }
        );
      }
    }

    // Fallback to mock data
    const mockIndicators = generateMacroIndicators();

    return NextResponse.json(
      {
        success: true,
        data: {
          indicators: mockIndicators,
          timestamp: new Date().toISOString(),
          source: 'mock',
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (error) {
    console.error('[Macro API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch macro indicators',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Fetch real macro data from FRED
 */
async function fetchRealMacroData() {
  try {
  
    if (!process.env.FRED_API_KEY) {
    
      console.warn('[Macro API] FRED_API_KEY not configured');
      return null;
    }

    const results = await Promise.all(
      MACRO_INDICATORS.slice(0, ).map((ind) =>
        fredAPI.getLatest(ind.key)
      )
    );
     console.log("in try",results)
    return results
      .filter((result) => result !== null)
      .map((result, idx) =>
        transformFREDtoMacro(
          MACRO_INDICATORS[idx].key,
          result
        )
      );
  } catch (error) {
    console.warn('[Macro API] Real data fetch failed, will use mock');
    return null;
  }
}

/**
 * GET /api/data/macro/:seriesId
 * Get specific macro series
 */
export async function getSeriesHandler(
  request: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  try {
    const { seriesId } = params;
    const useRealData = request.nextUrl.searchParams.get('real') !== 'false';
console.log("here sereis handler")
    if (useRealData && process.env.FRED_API_KEY) {
      const data = await fredAPI.getSeries(seriesId, 20);
      if (data) {
        return NextResponse.json(
          {
            success: true,
            data: {
              seriesId,
              observations: data,
              source: 'fred',
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          },
          { headers: { 'Cache-Control': 'public, max-age=3600' } }
        );
      }
    }

    // Mock data fallback
    return NextResponse.json(
      {
        success: true,
        data: {
          seriesId,
          observations: generateMacroIndicators(),
          source: 'mock',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (error) {
    console.error('[Macro API Series] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch series data',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
