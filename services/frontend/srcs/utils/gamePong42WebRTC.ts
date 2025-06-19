import { Device, DataProducer, DataConsumer } from 'mediasoup-client';
import { PlayerInfo } from './types';

interface GamePong42WebRTCConfig {
  sfuUrl: string;
  socketId: string;
  playerInfo: PlayerInfo;
}

interface GamePong42Data {
  type: 'gameState' | 'playerInput' | 'gameEvent' | 'npcStates';
  payload: any;
  timestamp: number;
  from?: string;
}

export class GamePong42WebRTC {
  private config: GamePong42WebRTCConfig;
  private device: Device | null = null;
  private sendTransport: any = null;
  private recvTransport: any = null;
  private dataProducer: DataProducer | null = null;
  private dataConsumers: Map<string, DataConsumer> = new Map();
  private connected: boolean = false;
  private roomNumber: string | null = null;
  private isRoomLeader: boolean = false;

  // Event handlers
  public onConnectionStateChange?: (connected: boolean) => void;
  public onRoomJoined?: (data: { roomNumber: string; isRoomLeader: boolean; participantCount: number }) => void;
  public onDataReceived?: (data: GamePong42Data) => void;
  public onPlayerJoined?: (playerId: string) => void;
  public onPlayerLeft?: (playerId: string) => void;
  public onError?: (error: string) => void;

  constructor(config: GamePong42WebRTCConfig) {
    this.config = config;
    console.log('🎮 Initializing WebRTC for GamePong42...');
  }

  async connect(): Promise<void> {
    try {
      console.log('🔄 Connecting to SFU42 WebRTC server...');

      // Get router capabilities from SFU
      const response = await fetch(`${this.config.sfuUrl}/router-capabilities`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to get router capabilities: ${response.statusText}`);
      }

      const { capabilities } = await response.json();

      // Create mediasoup device
      this.device = new Device();
      await this.device.load({ routerRtpCapabilities: capabilities });

      console.log('✅ Mediasoup device loaded');

      // Create transports
      await this.createTransports();

      // Join GamePong42 room
      await this.joinRoom();

      this.connected = true;
      this.onConnectionStateChange?.(true);

      console.log('✅ WebRTC connection established');

    } catch (error: any) {
      console.error('❌ WebRTC connection failed:', error);
      this.onError?.(error.message || 'Connection failed');
      throw error;
    }
  }

  private async createTransports(): Promise<void> {
    // Create send transport
    const sendTransportResponse = await fetch(`${this.config.sfuUrl}/create-transport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socketId: this.config.socketId })
    });

    if (!sendTransportResponse.ok) {
      throw new Error('Failed to create send transport');
    }

    const sendTransportParams = await sendTransportResponse.json();

    this.sendTransport = this.device!.createSendTransport(sendTransportParams.params);

    // Handle transport events
    this.sendTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
      try {
        await fetch(`${this.config.sfuUrl}/connect-transport`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            socketId: this.config.socketId,
            dtlsParameters
          })
        });
        callback();
      } catch (error) {
        errback(error);
      }
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }: any, callback: any, errback: any) => {
      try {
        // This is for media, not used in GamePong42
        callback({ id: 'dummy' });
      } catch (error) {
        errback(error);
      }
    });

    this.sendTransport.on('producedata', async ({ sctpStreamParameters, label, protocol, appData }: any, callback: any, errback: any) => {
      try {
        const response = await fetch(`${this.config.sfuUrl}/create-data-producer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            socketId: this.config.socketId,
            sctpStreamParameters,
            label,
            protocol,
            appData
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create data producer');
        }

        const { dataProducerId } = await response.json();
        callback({ id: dataProducerId });
      } catch (error) {
        errback(error);
      }
    });

    // Create data producer for sending game data
    this.dataProducer = await this.sendTransport.produceData({
      ordered: false,
      maxRetransmits: 0,
      label: 'gamePong42Data',
      protocol: 'sctp'
    });

    console.log('✅ Send transport and data producer created');

    // For receive transport, we'll create it when needed for consuming data from other players
    // This will be handled in the joinRoom method
  }

  private async joinRoom(): Promise<void> {
    const response = await fetch(`${this.config.sfuUrl}/join-gamepong42-room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        socketId: this.config.socketId,
        playerInfo: this.config.playerInfo
      })
    });

    if (!response.ok) {
      throw new Error('Failed to join GamePong42 room');
    }

    const roomData = await response.json();
    this.roomNumber = roomData.roomNumber;
    this.isRoomLeader = roomData.isRoomLeader;

    this.onRoomJoined?.(roomData);

    console.log(`✅ Joined GamePong42 room: ${this.roomNumber}, Leader: ${this.isRoomLeader}`);
  }

  async sendData(data: GamePong42Data): Promise<void> {
    if (!this.dataProducer || !this.connected) {
      console.warn('⚠️ Cannot send data: not connected or no data producer');
      return;
    }

    try {
      const message = JSON.stringify({
        ...data,
        from: this.config.socketId,
        timestamp: Date.now()
      });

      await this.dataProducer.send(message);
    } catch (error) {
      console.error('❌ Failed to send data:', error);
    }
  }

  async sendGameState(gameState: any): Promise<void> {
    await this.sendData({
      type: 'gameState',
      payload: gameState,
      timestamp: Date.now()
    });
  }

  async sendPlayerInput(input: any): Promise<void> {
    await this.sendData({
      type: 'playerInput',
      payload: input,
      timestamp: Date.now()
    });
  }

  async sendNPCRequest(request: any): Promise<any> {
    try {
      const response = await fetch(`${this.config.sfuUrl}/npc-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          roomNumber: this.roomNumber,
          requesterId: this.config.socketId
        })
      });

      if (!response.ok) {
        throw new Error('NPC request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('❌ NPC request failed:', error);
      throw error;
    }
  }

  async startGameAsLeader(): Promise<void> {
    if (!this.isRoomLeader) {
      console.warn('⚠️ Only room leader can start the game');
      return;
    }

    // Send NPC request first
    try {
      const npcResponse = await this.sendNPCRequest({
        type: 'join',
        npcCount: Math.max(0, 42 - 1) // Assuming 1 player for now
      });

      console.log('✅ NPC request successful:', npcResponse);
    } catch (error) {
      console.error('❌ Failed to request NPCs:', error);
    }

    // Send game start event
    await this.sendData({
      type: 'gameEvent',
      payload: {
        event: 'gameStart',
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });
  }

  disconnect(): void {
    try {
      // Close data producer
      if (this.dataProducer) {
        this.dataProducer.close();
        this.dataProducer = null;
      }

      // Close data consumers
      for (const [id, consumer] of this.dataConsumers) {
        consumer.close();
      }
      this.dataConsumers.clear();

      // Close transports
      if (this.sendTransport) {
        this.sendTransport.close();
        this.sendTransport = null;
      }

      if (this.recvTransport) {
        this.recvTransport.close();
        this.recvTransport = null;
      }

      this.connected = false;
      this.onConnectionStateChange?.(false);

      console.log('✅ WebRTC connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.connected;
  }

  get currentRoomNumber(): string | null {
    return this.roomNumber;
  }

  get isCurrentRoomLeader(): boolean {
    return this.isRoomLeader;
  }
}

// Export utility function to create WebRTC instance
export function createGamePong42WebRTC(config: {
  sfuUrl: string;
  playerInfo: PlayerInfo;
}): GamePong42WebRTC {
  const socketId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return new GamePong42WebRTC({
    ...config,
    socketId
  });
}
