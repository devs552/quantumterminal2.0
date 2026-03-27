// WebSocket Manager for Real-time Updates
// Handles connection management, subscriptions, and broadcasting

export type Channel = 'markets' | 'crypto' | 'news' | 'alerts' | 'ai' | 'map';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'update' | 'alert' | 'ping';
  channels?: Channel[];
  data?: any;
  timestamp?: number;
}

export interface ClientConnection {
  id: string;
  subscriptions: Set<Channel>;
  socket: WebSocket;
  connected: boolean;
}

export class WebSocketManager {
  private clients: Map<string, ClientConnection> = new Map();
  private channelSubscriptions: Map<Channel, Set<string>> = new Map();
  private messageQueue: WebSocketMessage[] = [];

  constructor() {
    // Initialize channel subscriptions
    const channels: Channel[] = ['markets', 'crypto', 'news', 'alerts', 'ai', 'map'];
    channels.forEach((channel) => {
      this.channelSubscriptions.set(channel, new Set());
    });

    // Start background update service
    this.startUpdateService();
  }

  registerClient(id: string, socket: WebSocket): ClientConnection {
    const client: ClientConnection = {
      id,
      subscriptions: new Set(),
      socket,
      connected: true,
    };

    this.clients.set(id, client);
    console.log(`[WS] Client ${id} connected. Total clients: ${this.clients.size}`);

    return client;
  }

  unregisterClient(id: string) {
    const client = this.clients.get(id);
    if (client) {
      // Remove from all channel subscriptions
      client.subscriptions.forEach((channel) => {
        const subscribers = this.channelSubscriptions.get(channel);
        if (subscribers) {
          subscribers.delete(id);
        }
      });

      this.clients.delete(id);
      console.log(`[WS] Client ${id} disconnected. Total clients: ${this.clients.size}`);
    }
  }

  subscribe(clientId: string, channels: Channel[]) {
    const client = this.clients.get(clientId);
    if (!client) return;

    channels.forEach((channel) => {
      client.subscriptions.add(channel);
      const subscribers = this.channelSubscriptions.get(channel);
      if (subscribers) {
        subscribers.add(clientId);
      }
    });

    console.log(`[WS] Client ${clientId} subscribed to: ${channels.join(', ')}`);
  }

  unsubscribe(clientId: string, channels: Channel[]) {
    const client = this.clients.get(clientId);
    if (!client) return;

    channels.forEach((channel) => {
      client.subscriptions.delete(channel);
      const subscribers = this.channelSubscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(clientId);
      }
    });
  }

  broadcast(channel: Channel, message: any) {
    const subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers) return;

    const wsMessage: WebSocketMessage = {
      type: 'update',
      channels: [channel],
      data: message,
      timestamp: Date.now(),
    };

    const messageStr = JSON.stringify(wsMessage);

    subscribers.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client && client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(messageStr);
        } catch (error) {
          console.error(`[WS] Error sending to client ${clientId}:`, error);
        }
      }
    });
  }

  broadcastAlert(severity: 'critical' | 'warning' | 'info', message: string) {
    const alert = {
      severity,
      message,
      timestamp: Date.now(),
    };

    this.broadcast('alerts', alert);
  }

  private startUpdateService() {
    // Simulate real-time updates
    setInterval(() => {
      // Market updates every 5 seconds
      this.broadcast('markets', {
        type: 'market_update',
        data: this.generateMarketUpdate(),
      });

      // Crypto updates every 3 seconds
      this.broadcast('crypto', {
        type: 'crypto_update',
        data: this.generateCryptoUpdate(),
      });
    }, 3000);

    // News updates every 30 seconds
    setInterval(() => {
      this.broadcast('news', {
        type: 'news_update',
        data: { articles: [] },
      });
    }, 30000);
  }

  private generateMarketUpdate() {
    return {
      timestamp: Date.now(),
      markets: [
        { symbol: 'SPX', price: 4782.61 + Math.random() * 20, change: 1.24 },
        { symbol: 'NDX', price: 16384.45 + Math.random() * 50, change: 2.15 },
      ],
    };
  }

  private generateCryptoUpdate() {
    return {
      timestamp: Date.now(),
      assets: [
        { symbol: 'BTC', price: 42156.78 + Math.random() * 100, change: 3.45 },
        { symbol: 'ETH', price: 2234.56 + Math.random() * 10, change: 2.89 },
      ],
    };
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getChannelSubscriberCount(channel: Channel): number {
    return this.channelSubscriptions.get(channel)?.size || 0;
  }
}

export const wsManager = new WebSocketManager();
