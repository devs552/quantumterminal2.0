import { NextRequest, NextResponse } from 'next/server';
import { generateNews } from '@/lib/mock-data-generator';
import { newsAPI, transformNewsAPIArticle } from '@/lib/external-apis';

/**
 * GET /api/data/news
 * Returns news articles with intelligent filtering and sentiment analysis
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const category = searchParams.get('category') || 'markets';
    const useRealData = searchParams.get('real') !== 'false';

    // Try to fetch real news data
    if (useRealData) {
      const realNews = await fetchRealNews(category);
      if (realNews && realNews.length > 0) {
        return NextResponse.json(
          {
            success: true,
            data: {
              articles: realNews.slice(0, limit),
              category,
              count: realNews.length,
              timestamp: new Date().toISOString(),
              source: 'newsapi',
            },
            timestamp: new Date().toISOString(),
          },
          { headers: { 'Cache-Control': 'public, max-age=300' } }
        );
      }
    }

    // Fallback to mock data
    const mockNews = generateNews(limit);

    return NextResponse.json(
      {
        success: true,
        data: {
          articles: mockNews,
          category,
          count: mockNews.length,
          timestamp: new Date().toISOString(),
          source: 'mock',
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    );
  } catch (error) {
    console.error('[News API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch news',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Fetch real news from NewsAPI
 */
async function fetchRealNews(category: string) {
  try {
    if (!process.env.NEWS_API_KEY) {
      console.warn('[News API] NEWS_API_KEY not configured');
      return null;
    }

    const query = getCategoryQuery(category);
    const articles = await newsAPI.getHeadlines(query, 'publishedAt', 100);

    if (!articles) return null;

    return articles
      .map((article: any) => transformNewsAPIArticle(article))
      .filter((article: any) => article.title && article.source);
  } catch (error) {
    console.warn('[News API] Real data fetch failed, will use mock');
    return null;
  }
}

/**
 * Helper: Map category to query string
 */
function getCategoryQuery(category: string): string {
  const queries: Record<string, string> = {
    markets: 'stock market OR cryptocurrency OR trading OR financial',
    geopolitics: 'geopolitics OR conflict OR military OR diplomacy',
    technology: 'technology OR AI OR innovation OR software',
    energy: 'oil OR natural gas OR energy OR renewable',
    economy: 'economy OR inflation OR recession OR GDP',
    crypto: 'bitcoin OR ethereum OR cryptocurrency OR blockchain',
  };
  return queries[category] || queries.markets;
}

/**
 * POST /api/data/news/filter
 * Filter news by sentiment, source, or region
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sentiment, sources, region, limit = 50 } = body;

    // Generate mock news and filter
    const allNews = generateNews(100);
    let filtered = allNews;

    if (sentiment) {
      filtered = filtered.filter((n) => n.sentiment === sentiment);
    }

    if (region) {
      filtered = filtered.filter((n) => n.region === region);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          articles: filtered.slice(0, limit),
          filters: { sentiment, sources, region },
          count: filtered.length,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-cache' } }
    );
  } catch (error) {
    console.error('[News API Filter] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to filter news',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data/news/analyze
 * Analyze news for sentiment and relevance
 */
export async function analyzeNews(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content } = body;

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: 'title is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Sentiment analysis
    const text = `${title} ${content || ''}`.toLowerCase();
    const negativekeywords = ['crash', 'plunge', 'decline', 'fall', 'loss', 'crisis'];
    const positivekeywords = ['surge', 'rally', 'gain', 'rise', 'soar', 'boom'];

    const negativeCount = negativekeywords.filter((k) => text.includes(k)).length;
    const positiveCount = positivekeywords.filter((k) => text.includes(k)).length;

    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveCount > negativeCount) sentiment = 'positive';
    if (negativeCount > positiveCount) sentiment = 'negative';

    const sentimentScore = (positiveCount - negativeCount) / Math.max(1, positiveCount + negativeCount);

    return NextResponse.json(
      {
        success: true,
        data: {
          title,
          sentiment,
          sentimentScore,
          confidence: Math.abs(sentimentScore),
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-cache' } }
    );
  } catch (error) {
    console.error('[News Analyze] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze news',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
