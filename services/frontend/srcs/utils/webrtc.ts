import * as mediasoupClient from 'mediasoup-client';
import { Socket } from 'socket.io-client';

export interface WebRTCManager {
  device: any | null;
  sendTransport: any | null;
  recvTransport: any | null;
  producers: Map<string, any>;
  consumers: Map<string, any>;
  isInitialized: boolean;
}

export class GamePong42WebRTC {
  private socket: Socket;
  private device: any | null = null;
  private sendTransport: any | null = null;
  private recvTransport: any | null = null;
  private producers: Map<string, any> = new Map();
  private consumers: Map<string, any> = new Map();
  private gameDataProducer: any | null = null;
  private isInitialized: boolean = false;

  constructor(socket: Socket) {
    this.socket = socket;
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🎮 Initializing WebRTC for GamePong42...');

      // Create mediasoup Device
      this.device = new mediasoupClient.Device();

      // Get router RTP capabilities from SFU
      const rtpCapabilities = await this.getRtpCapabilities();
      if (!rtpCapabilities) {
        throw new Error('Failed to get RTP capabilities');
      }

      // Load device with capabilities
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });
      console.log('✅ Mediasoup device loaded successfully');

      // Create transports
      await this.createSendTransport();
      await this.createRecvTransport();

      this.isInitialized = true;
      console.log('✅ WebRTC initialization completed');
      return true;
    } catch (error) {
      console.error('❌ WebRTC initialization failed:', error);
      return false;
    }
  }

  private async getRtpCapabilities(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit('get-router-rtp-capabilities', (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.rtpCapabilities);
        }
      });
    });
  }

  private async createSendTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('create-webrtc-transport', { direction: 'send' }, async (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        try {
          console.log('🔧 Creating send transport with params:', JSON.stringify(response.params, null, 2));
          this.sendTransport = this.device!.createSendTransport(response.params);

          // Handle transport connection
          this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              await this.connectTransport(this.sendTransport!.id, dtlsParameters);
              callback();
            } catch (error) {
              errback(error as Error);
            }
          });

          // Handle transport produce
          this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
            try {
              const { id } = await this.produce(this.sendTransport!.id, kind, rtpParameters);
              callback({ id });
            } catch (error) {
              errback(error as Error);
            }
          });

          // Handle data produce
          this.sendTransport.on('producedata', async ({ sctpStreamParameters, label, protocol }, callback, errback) => {
            try {
              const { id } = await this.produceData(this.sendTransport!.id, sctpStreamParameters, label, protocol);
              callback({ id });
            } catch (error) {
              errback(error as Error);
            }
          });

          console.log('✅ Send transport created');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async createRecvTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('create-webrtc-transport', { direction: 'recv' }, async (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        try {
          console.log('🔧 Creating receive transport with params:', JSON.stringify(response.params, null, 2));
          this.recvTransport = this.device!.createRecvTransport(response.params);

          // Handle transport connection
          this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              await this.connectTransport(this.recvTransport!.id, dtlsParameters);
              callback();
            } catch (error) {
              errback(error as Error);
            }
          });

          console.log('✅ Receive transport created');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async connectTransport(transportId: string, dtlsParameters: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('connect-transport', { transportId, dtlsParameters }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  private async produce(transportId: string, kind: string, rtpParameters: any): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      this.socket.emit('produce', { transportId, kind, rtpParameters }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  private async produceData(transportId: string, sctpStreamParameters: any, label: string, protocol: string): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      this.socket.emit('produce-data', { transportId, sctpStreamParameters, label, protocol }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async createGameDataChannel(): Promise<boolean> {
    try {
      if (!this.sendTransport) {
        throw new Error('Send transport not available');
      }

      console.log('🔧 Creating data channel. Send transport state:', {
        id: this.sendTransport.id,
        connectionState: this.sendTransport.connectionState,
        sctpState: (this.sendTransport as any).sctpState,
        sctpParameters: (this.sendTransport as any).sctpParameters,
      });

      // Create a data producer for game state
      this.gameDataProducer = await this.sendTransport.produceData({
        label: 'gamePong42Data',
        protocol: 'game-data',
        ordered: true
      });

      console.log('✅ Game data channel created');
      return true;
    } catch (error) {
      console.error('❌ Failed to create game data channel:', error);
      return false;
    }
  }

  sendGameState(gameState: any): boolean {
    try {
      if (!this.gameDataProducer || this.gameDataProducer.closed) {
        console.warn('⚠️ Game data producer not available');
        return false;
      }

      const message = JSON.stringify({
        type: 'gameState',
        data: gameState,
        timestamp: Date.now()
      });

      this.gameDataProducer.send(message);
      return true;
    } catch (error) {
      console.error('❌ Failed to send game state:', error);
      return false;
    }
  }

  onGameStateReceived(callback: (gameState: any) => void): void {
    // Handle incoming game state from data consumers
    // This will be set up when we consume data from other participants
    // For now, also listen to Socket.IO as fallback
    this.socket.on('gamepong42-state', (data) => {
      try {
        callback(data.gameState);
      } catch (error) {
        console.error('❌ Error processing received game state:', error);
      }
    });
  }

  async consume(producerId: string, kind: string): Promise<any | null> {
    try {
      if (!this.recvTransport) {
        throw new Error('Receive transport not available');
      }

      const consumer = await new Promise<any>((resolve, reject) => {
        this.socket.emit('consume', {
          transportId: this.recvTransport!.id,
          producerId,
          rtpCapabilities: this.device!.rtpCapabilities
        }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      const consumerObj = await this.recvTransport.consume({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });

      // Resume consumer
      await new Promise<void>((resolve, reject) => {
        this.socket.emit('resume-consumer', { consumerId: consumer.id }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve();
          }
        });
      });

      this.consumers.set(producerId, consumerObj);
      console.log(`✅ Consumer created for producer ${producerId}`);

      return consumerObj;
    } catch (error) {
      console.error(`❌ Failed to consume producer ${producerId}:`, error);
      return null;
    }
  }

  disconnect(): void {
    try {
      // Close all producers
      this.producers.forEach((producer) => {
        if (!producer.closed) {
          producer.close();
        }
      });
      this.producers.clear();

      // Close all consumers
      this.consumers.forEach((consumer) => {
        if (!consumer.closed) {
          consumer.close();
        }
      });
      this.consumers.clear();

      // Close transports
      if (this.sendTransport && !this.sendTransport.closed) {
        this.sendTransport.close();
      }
      if (this.recvTransport && !this.recvTransport.closed) {
        this.recvTransport.close();
      }

      this.device = null;
      this.sendTransport = null;
      this.recvTransport = null;
      this.gameDataProducer = null;

      console.log('✅ WebRTC disconnected and cleaned up');
    } catch (error) {
      console.error('❌ Error during WebRTC disconnect:', error);
    }
  }

  getStats(): {
    device: boolean;
    sendTransport: boolean;
    recvTransport: boolean;
    producers: number;
    consumers: number;
  } {
    return {
      device: !!this.device,
      sendTransport: !!this.sendTransport && !this.sendTransport.closed,
      recvTransport: !!this.recvTransport && !this.recvTransport.closed,
      producers: this.producers.size,
      consumers: this.consumers.size
    };
  }
}
