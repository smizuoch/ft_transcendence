import { MediasoupService } from './mediasoup-service';
import { GamePong42Manager, GamePong42Room } from './game-pong42-manager';
import { PlayerInfo } from './types';

interface WebRTCConnection {
  socketId: string;
  transportId?: string;
  dataProducerId?: string;
  dataConsumerIds: string[];
  playerInfo: PlayerInfo;
}

export class GamePong42WebRTCRoomManager {
  private mediasoupService: MediasoupService;
  private gamePong42Manager: GamePong42Manager;
  private connections: Map<string, WebRTCConnection> = new Map();
  private roomConnections: Map<string, Set<string>> = new Map();
  private roomLeaders: Map<string, string> = new Map();

  constructor(mediasoupService: MediasoupService, gamePong42Manager: GamePong42Manager) {
    this.mediasoupService = mediasoupService;
    this.gamePong42Manager = gamePong42Manager;
  }

  async addConnection(socketId: string, playerInfo: PlayerInfo): Promise<void> {
    this.connections.set(socketId, {
      socketId,
      dataConsumerIds: [],
      playerInfo
    });
  }

  async removeConnection(socketId: string): Promise<void> {
    // Remove from all rooms
    for (const [roomId, connectionSet] of this.roomConnections.entries()) {
      if (connectionSet.has(socketId)) {
        await this.leaveRoom(socketId, roomId);
      }
    }

    // Clean up WebRTC resources
    const connection = this.connections.get(socketId);
    if (connection) {
      // Close data consumers
      for (const consumerId of connection.dataConsumerIds) {
        await this.mediasoupService.closeConsumer(consumerId);
      }

      // Close data producer
      if (connection.dataProducerId) {
        await this.mediasoupService.closeDataProducer(connection.dataProducerId);
      }

      // Close transport
      if (connection.transportId) {
        await this.mediasoupService.closeTransport(connection.transportId);
      }
    }

    this.connections.delete(socketId);
  }

  async joinRoom(socketId: string, roomId: string): Promise<GamePong42Room> {
    const connection = this.connections.get(socketId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // Get or create GamePong42 room
    const room = this.gamePong42Manager.getAvailableRoom();
    const actualRoomId = room.id;

    // Add to room connections
    if (!this.roomConnections.has(actualRoomId)) {
      this.roomConnections.set(actualRoomId, new Set());
    }

    const roomConnections = this.roomConnections.get(actualRoomId)!;
    const wasEmpty = roomConnections.size === 0;

    roomConnections.add(socketId);

    // Set room leader if first participant
    if (wasEmpty) {
      this.roomLeaders.set(actualRoomId, socketId);
    }

    // Add participant to GamePong42 room
    room.addParticipant(socketId, connection.playerInfo);

    // Setup WebRTC data channels for all participants in the room
    await this.setupDataChannels(socketId, actualRoomId);

    return room;
  }

  async leaveRoom(socketId: string, roomId: string): Promise<void> {
    const roomConnections = this.roomConnections.get(roomId);
    if (!roomConnections) return;

    const wasLeader = this.roomLeaders.get(roomId) === socketId;
    roomConnections.delete(socketId);

    // Remove from GamePong42 room
    const room = this.gamePong42Manager.getRoom(roomId);
    if (room) {
      room.removeParticipant(socketId);
    }

    // Clean up empty room
    if (roomConnections.size === 0) {
      this.roomConnections.delete(roomId);
      this.roomLeaders.delete(roomId);
      this.gamePong42Manager.removeRoom(roomId);
    } else if (wasLeader) {
      // Assign new leader
      const newLeader = Array.from(roomConnections)[0];
      this.roomLeaders.set(roomId, newLeader);
    }

    // Clean up WebRTC data channels
    await this.cleanupDataChannels(socketId, roomId);
  }

  async createWebRTCTransport(socketId: string): Promise<any> {
    const transportParams = await this.mediasoupService.createWebRtcTransport(socketId);

    const connection = this.connections.get(socketId);
    if (connection) {
      connection.transportId = transportParams.params.id;
    }

    return transportParams;
  }

  async connectTransport(socketId: string, dtlsParameters: any): Promise<void> {
    const connection = this.connections.get(socketId);
    if (!connection || !connection.transportId) {
      throw new Error('Transport not found');
    }

    await this.mediasoupService.connectWebRtcTransport(connection.transportId, dtlsParameters);
  }

  async createDataProducer(socketId: string, sctpStreamParameters: any, label: string): Promise<string> {
    const connection = this.connections.get(socketId);
    if (!connection || !connection.transportId) {
      throw new Error('Transport not found');
    }

    const dataProducerId = await this.mediasoupService.createDataProducer(
      connection.transportId,
      sctpStreamParameters,
      label
    );

    connection.dataProducerId = dataProducerId;
    return dataProducerId;
  }

  async createDataConsumer(socketId: string, dataProducerId: string): Promise<any> {
    const connection = this.connections.get(socketId);
    if (!connection || !connection.transportId) {
      throw new Error('Transport not found');
    }

    const dataConsumerParams = await this.mediasoupService.createDataConsumer(
      connection.transportId,
      dataProducerId
    );

    connection.dataConsumerIds.push(dataConsumerParams.id);
    return dataConsumerParams;
  }

  private async setupDataChannels(socketId: string, roomId: string): Promise<void> {
    const roomConnections = this.roomConnections.get(roomId);
    if (!roomConnections) return;

    const newConnection = this.connections.get(socketId);
    if (!newConnection || !newConnection.dataProducerId) return;

    // Create data consumers for the new participant to receive from existing participants
    for (const existingSocketId of roomConnections) {
      if (existingSocketId === socketId) continue;

      const existingConnection = this.connections.get(existingSocketId);
      if (existingConnection && existingConnection.dataProducerId) {
        try {
          await this.createDataConsumer(socketId, existingConnection.dataProducerId);
        } catch (error) {
          console.error(`Failed to create data consumer for ${socketId} from ${existingSocketId}:`, error);
        }
      }
    }

    // Create data consumers for existing participants to receive from the new participant
    for (const existingSocketId of roomConnections) {
      if (existingSocketId === socketId) continue;

      try {
        await this.createDataConsumer(existingSocketId, newConnection.dataProducerId);
      } catch (error) {
        console.error(`Failed to create data consumer for ${existingSocketId} from ${socketId}:`, error);
      }
    }
  }

  private async cleanupDataChannels(socketId: string, roomId: string): Promise<void> {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    // Close all data consumers for this connection
    for (const consumerId of connection.dataConsumerIds) {
      try {
        await this.mediasoupService.closeConsumer(consumerId);
      } catch (error) {
        console.error(`Failed to close data consumer ${consumerId}:`, error);
      }
    }

    connection.dataConsumerIds = [];

    // Remove data consumers in other connections that were consuming from this connection
    const roomConnections = this.roomConnections.get(roomId);
    if (roomConnections && connection.dataProducerId) {
      for (const otherSocketId of roomConnections) {
        if (otherSocketId === socketId) continue;

        const otherConnection = this.connections.get(otherSocketId);
        if (otherConnection) {
          // Find and remove consumers that were consuming from the leaving participant
          const consumersToRemove = [];
          for (const consumerId of otherConnection.dataConsumerIds) {
            // Note: In a real implementation, you'd need to track which consumer corresponds to which producer
            // This is a simplified version
          }
        }
      }
    }
  }

  getRoomConnections(roomId: string): Set<string> | undefined {
    return this.roomConnections.get(roomId);
  }

  getRoomLeader(roomId: string): string | undefined {
    return this.roomLeaders.get(roomId);
  }

  isRoomLeader(socketId: string, roomId: string): boolean {
    return this.roomLeaders.get(roomId) === socketId;
  }

  getAllRooms(): string[] {
    return Array.from(this.roomConnections.keys());
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getRoomCount(): number {
    return this.roomConnections.size;
  }
}
