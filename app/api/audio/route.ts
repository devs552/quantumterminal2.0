import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Audio notification trigger endpoint
 * Generates or retrieves audio data for different trading events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventType, volume, price, imbalance } = body;

    // Determine which audio sample to use based on event type
    let audioUrl = '';
    let description = '';

    switch (eventType) {
      case 'largeVolume':
        // Trigger on volume spike
        const volumeIntensity = Math.min(volume / 1000, 5); // Scale 0-5
        audioUrl = `/sounds/volume-spike-${Math.ceil(volumeIntensity)}.mp3`;
        description = `Large volume detected: ${volume} BTC`;
        break;

      case 'priceBreakout':
        // Trigger on price level breakout
        audioUrl = `/sounds/breakout-${price > 0 ? 'up' : 'down'}.mp3`;
        description = `Price breakout at ${price}`;
        break;

      case 'orderImbalance':
        // Trigger on large buy/sell imbalance
        const imbalanceAbs = Math.abs(imbalance || 0);
        if (imbalanceAbs > 0.7) {
          audioUrl = `/sounds/imbalance-${imbalance > 0 ? 'buy' : 'sell'}.mp3`;
          description = `Order imbalance detected: ${(imbalance * 100).toFixed(1)}%`;
        }
        break;

      case 'liquidation':
        audioUrl = '/sounds/liquidation-alert.mp3';
        description = 'Large liquidation detected';
        break;

      case 'ponr':
        // Point of No Return (POC change)
        audioUrl = '/sounds/poc-shift.mp3';
        description = 'Point of Control shifted';
        break;

      default:
        audioUrl = '/sounds/notification.mp3';
        description = 'Trading notification';
    }

    // For production, you might generate the audio on the fly or use a text-to-speech API
    // For now, we return metadata about which sound to play

    return NextResponse.json({
      success: true,
      data: {
        eventType,
        audioUrl,
        description,
        volume: 0.5, // Default volume (0-1)
        shouldPlay: true,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Audio API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process audio request',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/audio/test
 * Test endpoint to list available sounds
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      availableSounds: [
        'volume-spike-1.mp3',
        'volume-spike-2.mp3',
        'volume-spike-3.mp3',
        'volume-spike-4.mp3',
        'volume-spike-5.mp3',
        'breakout-up.mp3',
        'breakout-down.mp3',
        'imbalance-buy.mp3',
        'imbalance-sell.mp3',
        'liquidation-alert.mp3',
        'poc-shift.mp3',
        'notification.mp3',
      ],
      soundsPath: '/sounds/',
      description:
        'Sound effects for trading events. Place .mp3 files in public/sounds directory.',
    },
    timestamp: Date.now(),
  });
}

/**
 * POST /api/audio
 * 
 * Request Body:
 * {
 *   "eventType": "largeVolume" | "priceBreakout" | "orderImbalance" | "liquidation" | "ponr",
 *   "volume"?: number,
 *   "price"?: number,
 *   "imbalance"?: number (0-1, where >0.5 = buy heavy, <0.5 = sell heavy)
 * }
 * 
 * Example:
 * POST /api/audio
 * {
 *   "eventType": "largeVolume",
 *   "volume": 500
 * }
 */
