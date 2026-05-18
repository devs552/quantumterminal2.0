/**
 * Audio Manager for trading sound effects
 * Handles sound playback driven by trade streams and market events
 */

export interface AudioTriggerConfig {
  enabled: boolean;
  volumePercentage: number;
  triggers: {
    largeVolume?: {
      threshold: number;
      enabled: boolean;
    };
    priceBreakout?: {
      threshold: number;
      enabled: boolean;
    };
    orderImbalance?: {
      threshold: number;
      enabled: boolean;
    };
    liquidation?: {
      enabled: boolean;
    };
  };
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private config: AudioTriggerConfig;
  private audioCache: Map<string, AudioBuffer> = new Map();
  private lastPlayedTime: Map<string, number> = new Map();
  private cooldownMs: number = 100; // Prevent audio spam

  constructor(config: Partial<AudioTriggerConfig> = {}) {
    this.config = {
      enabled: true,
      volumePercentage: 50,
      triggers: {
        largeVolume: { threshold: 500, enabled: true },
        priceBreakout: { threshold: 1, enabled: true },
        orderImbalance: { threshold: 0.6, enabled: true },
        liquidation: { enabled: true },
      },
      ...config,
    };

    this.initAudioContext();
  }

  private initAudioContext(): void {
    if (typeof window !== 'undefined' && !this.audioContext) {
      try {
        const AudioContext =
          window.AudioContext ||
          (window as any).webkitAudioContext;
        this.audioContext = new AudioContext();
      } catch (error) {
        console.warn('AudioContext not available:', error);
      }
    }
  }

  /**
   * Play a sound effect by URL
   */
  async playSound(soundUrl: string, volume: number = 0.5): Promise<void> {
    if (!this.config.enabled || !this.audioContext) return;

    // Check cooldown to prevent spam
    const lastPlayed = this.lastPlayedTime.get(soundUrl) || 0;
    if (Date.now() - lastPlayed < this.cooldownMs) return;

    try {
      // Try using HTML5 Audio first (simpler)
      const audio = new Audio(soundUrl);
      audio.volume = (this.config.volumePercentage / 100) * volume;
      audio.play().catch((err) =>
        console.warn('Audio playback error:', err)
      );

      this.lastPlayedTime.set(soundUrl, Date.now());
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  }

  /**
   * Generate and play a tone for different events
   */
  playTone(
    frequency: number = 440,
    duration: number = 200,
    volume: number = 0.5
  ): void {
    if (!this.config.enabled || !this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      const oscNode = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscNode.frequency.value = frequency;
      oscNode.type = 'sine';

      gainNode.gain.setValueAtTime(
        (this.config.volumePercentage / 100) * volume,
        now
      );
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

      oscNode.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscNode.start(now);
      oscNode.stop(now + duration / 1000);
    } catch (error) {
      console.error('Failed to play tone:', error);
    }
  }

  /**
   * Handle large volume event
   */
  handleLargeVolume(volume: number): void {
    if (
      !this.config.triggers.largeVolume?.enabled ||
      volume < (this.config.triggers.largeVolume?.threshold || 500)
    ) {
      return;
    }

    // Scale frequency based on volume
    const frequency = 300 + (volume / 1000) * 500; // 300-800 Hz
    this.playTone(frequency, 150, 0.6);
  }

  /**
   * Handle price breakout event
   */
  handlePriceBreakout(direction: 'up' | 'down'): void {
    if (!this.config.triggers.priceBreakout?.enabled) return;

    const frequency = direction === 'up' ? 800 : 300;
    this.playTone(frequency, 200, 0.7);
  }

  /**
   * Handle order imbalance event
   */
  handleOrderImbalance(imbalance: number): void {
    if (
      !this.config.triggers.orderImbalance?.enabled ||
      Math.abs(imbalance) < (this.config.triggers.orderImbalance?.threshold || 0.6)
    ) {
      return;
    }

    const frequency = imbalance > 0.5 ? 600 : 400; // Buy high, sell low
    this.playTone(frequency, 250, 0.65);
  }

  /**
   * Handle liquidation event
   */
  handleLiquidation(): void {
    if (!this.config.triggers.liquidation?.enabled) return;

    // Play a more urgent double-tone pattern
    this.playTone(900, 100, 0.8);
    setTimeout(() => this.playTone(900, 100, 0.8), 150);
  }

  /**
   * Handle Point of Control shift
   */
  handlePOCShift(): void {
    if (!this.config.enabled) return;

    this.playTone(550, 120, 0.6);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AudioTriggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Enable/disable audio
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Set volume (0-100)
   */
  setVolume(percentage: number): void {
    this.config.volumePercentage = Math.max(0, Math.min(100, percentage));
  }

  /**
   * Resume audio context if suspended
   */
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

// Singleton instance
let audioManagerInstance: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}
