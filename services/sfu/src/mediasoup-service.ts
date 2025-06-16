import * as mediasoup from 'mediasoup';
import { Worker, Router, WebRtcTransport, Producer, Consumer, DataProducer, DataConsumer } from 'mediasoup/node/lib/types';

export class MediasoupService {
  private worker: Worker | null = null;
  private router: Router | null = null;
  private transports: Map<string, WebRtcTransport> = new Map();
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  // データチャネル用のプロデューサー/コンシューマー
  private dataProducers: Map<string, DataProducer> = new Map();
  private dataConsumers: Map<string, DataConsumer> = new Map();

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Mediasoup service...');

      // Mediasoupワーカーを作成
      this.worker = await mediasoup.createWorker({
        logLevel: 'warn', // debugから変更してログを減らす
        logTags: [
          'info',
          'ice',
          'dtls',
          'rtp',
          'srtp',
          'rtcp',
        ],
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
      });

      console.log('Mediasoup worker created successfully');

      this.worker.on('died', (error) => {
        console.error('Mediasoup worker died:', error);
        process.exit(1);
      });

      // ルーターを作成（SCTPサポート付き）
      this.router = await this.worker.createRouter({
        mediaCodecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
          },
          {
            kind: 'video',
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters: {
              'x-google-start-bitrate': 1000,
            },
          },
          {
            kind: 'video',
            mimeType: 'video/VP9',
            clockRate: 90000,
            parameters: {
              'profile-id': 2,
              'x-google-start-bitrate': 1000,
            },
          },
          {
            kind: 'video',
            mimeType: 'video/h264',
            clockRate: 90000,
            parameters: {
              'packetization-mode': 1,
              'profile-level-id': '4d0032',
              'level-asymmetry-allowed': 1,
              'x-google-start-bitrate': 1000,
            },
          },
        ],
        // SCTP用のアプリケーションデータ設定
        appData: {
          enableSctp: true
        }
      });

      console.log('Mediasoup service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Mediasoup service:', error);
      throw error;
    }
  }

  async createWebRtcTransport(socketId: string): Promise<{
    params: {
      id: string;
      iceParameters: any;
      iceCandidates: any;
      dtlsParameters: any;
      sctpParameters?: any;
    };
  }> {
    if (!this.router) {
      throw new Error('Router not initialized');
    }

    // ローカルネットワーク対応のためのlistenIps設定
    const listenIps = [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.ANNOUNCED_IP || this.getLocalIpAddress(),
      },
    ];

    // Dockerコンテナ内の場合は追加のlistenIpを設定
    if (process.env.DOCKER_ENV === 'true') {
      listenIps.push({
        ip: '0.0.0.0',
        announcedIp: process.env.HOST_IP || this.getLocalIpAddress(),
      });
    }

    const transport = await this.router.createWebRtcTransport({
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      // SCTPを有効化（データチャンネル用）
      enableSctp: true,
      numSctpStreams: { OS: 1024, MIS: 1024 },
    });

    this.transports.set(socketId, transport);

    // DTLS接続状態の詳細監視
    transport.on('dtlsstatechange', (dtlsState) => {
      console.log(`[DTLS] Transport ${transport.id} (${socketId}) state changed to: ${dtlsState}`);
      
      switch (dtlsState) {
        case 'connecting':
          console.log(`[DTLS] ${socketId}: DTLS handshake starting...`);
          break;
        case 'connected':
          console.log(`[DTLS] ${socketId}: DTLS handshake completed successfully! 🔒`);
          console.log(`[DTLS] ${socketId}: Secure connection established`);
          break;
        case 'failed':
          console.error(`[DTLS] ${socketId}: DTLS handshake failed! ❌`);
          break;
        case 'closed':
          console.log(`[DTLS] ${socketId}: DTLS connection closed`);
          transport.close();
          this.transports.delete(socketId);
          break;
      }
    });

    // ICE接続状態も監視
    transport.on('icestatechange', (iceState: any) => {
      console.log(`[ICE] Transport ${transport.id} (${socketId}) ICE state: ${iceState}`);
      
      switch (iceState) {
        case 'new':
          console.log(`[ICE] ${socketId}: ICE gathering started`);
          break;
        case 'checking':
          console.log(`[ICE] ${socketId}: ICE connectivity checks in progress`);
          break;
        case 'connected':
          console.log(`[ICE] ${socketId}: ICE connection established! 🌐`);
          break;
        case 'completed':
          console.log(`[ICE] ${socketId}: ICE connection completed successfully! ✅`);
          break;
        case 'failed':
          console.error(`[ICE] ${socketId}: ICE connection failed! ❌`);
          break;
        case 'disconnected':
          console.warn(`[ICE] ${socketId}: ICE connection disconnected! ⚠️`);
          break;
        case 'closed':
          console.log(`[ICE] ${socketId}: ICE connection closed`);
          break;
        default:
          console.log(`[ICE] ${socketId}: Unknown ICE state: ${iceState}`);
      }
    });

    // SCTP状態監視（データチャネル用）
    transport.on('sctpstatechange', (sctpState: any) => {
      console.log(`[SCTP] Transport ${transport.id} (${socketId}) SCTP state: ${sctpState}`);
    });

    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters, // SCTPパラメータを追加
      },
    };
  }

  async connectTransport(socketId: string, dtlsParameters: any): Promise<void> {
    const transport = this.transports.get(socketId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    await transport.connect({ dtlsParameters });
  }

  async produce(
    socketId: string,
    kind: 'audio' | 'video',
    rtpParameters: any,
    appData: any = {}
  ): Promise<{ id: string }> {
    const transport = this.transports.get(socketId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, socketId },
    });

    this.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      console.log('Producer transport closed');
      this.producers.delete(producer.id);
      producer.close();
    });

    return { id: producer.id };
  }

  async consume(
    socketId: string,
    producerId: string,
    rtpCapabilities: any
  ): Promise<{
    id: string;
    producerId: string;
    kind: string;
    rtpParameters: any;
  } | null> {
    if (!this.router) {
      throw new Error('Router not initialized');
    }

    const transport = this.transports.get(socketId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new Error('Producer not found');
    }

    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      console.warn('Cannot consume');
      return null;
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    this.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      console.log('Consumer transport closed');
      this.consumers.delete(consumer.id);
      consumer.close();
    });

    consumer.on('producerclose', () => {
      console.log('Consumer producer closed');
      this.consumers.delete(consumer.id);
      consumer.close();
    });

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  // データプロデューサー作成（ゲームデータ送信用）
  async createDataProducer(
    socketId: string,
    sctpStreamParameters: any,
    label: string = 'gameData',
    protocol: string = 'gameProtocol',
    appData: any = {}
  ): Promise<{ id: string; sctpStreamParameters: any }> {
    console.log(`[DATA-PRODUCER] Creating data producer for socket: ${socketId}`);
    console.log(`[DATA-PRODUCER] SCTP parameters:`, sctpStreamParameters);
    
    // 既存のデータプロデューサーをチェック
    const existingProducers = Array.from(this.dataProducers.values()).filter(
      producer => producer.appData && producer.appData.socketId === socketId
    );
    
    if (existingProducers.length > 0) {
      console.log(`[DATA-PRODUCER] ⚠️ Data producer already exists for socket: ${socketId}, returning existing one`);
      const existingProducer = existingProducers[0];
      return { 
        id: existingProducer.id, 
        sctpStreamParameters: existingProducer.sctpStreamParameters 
      };
    }
    
    const transport = this.transports.get(socketId);
    if (!transport) {
      console.error(`[DATA-PRODUCER] ❌ Transport not found for socket: ${socketId}`);
      throw new Error('Transport not found');
    }

    console.log(`[DATA-PRODUCER] Transport found, SCTP enabled: ${transport.sctpParameters ? 'YES' : 'NO'}`);
    console.log(`[DATA-PRODUCER] Transport SCTP parameters:`, transport.sctpParameters);

    try {
      const dataProducer = await transport.produceData({
        sctpStreamParameters,
        label,
        protocol,
        appData: { ...appData, socketId },
      });

      console.log(`[DATA-PRODUCER] ✅ Data producer created successfully: ${dataProducer.id}`);
      this.dataProducers.set(dataProducer.id, dataProducer);

      dataProducer.on('transportclose', () => {
        console.log('Data producer transport closed');
        this.dataProducers.delete(dataProducer.id);
        dataProducer.close();
      });

      return { 
        id: dataProducer.id, 
        sctpStreamParameters: dataProducer.sctpStreamParameters 
      };
    } catch (error) {
      console.error(`[DATA-PRODUCER] ❌ Failed to create data producer for socket ${socketId}:`, error);
      throw error;
    }
  }

  // データコンシューマー作成（ゲームデータ受信用）
  async createDataConsumer(
    socketId: string,
    dataProducerId: string,
    sctpCapabilities: any
  ): Promise<{
    id: string;
    dataProducerId: string;
    sctpStreamParameters: any;
    label: string;
    protocol: string;
  } | null> {
    if (!this.router) {
      throw new Error('Router not initialized');
    }

    const transport = this.transports.get(socketId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const dataProducer = this.dataProducers.get(dataProducerId);
    if (!dataProducer) {
      throw new Error('Data producer not found');
    }

    // データプロデューサーの場合、canConsumeチェックは不要
    // データチャネルは常に消費可能

    const dataConsumer = await transport.consumeData({
      dataProducerId,
    });

    this.dataConsumers.set(dataConsumer.id, dataConsumer);

    dataConsumer.on('transportclose', () => {
      console.log('Data consumer transport closed');
      this.dataConsumers.delete(dataConsumer.id);
      dataConsumer.close();
    });

    dataConsumer.on('dataproducerclose', () => {
      console.log('Data consumer producer closed');
      this.dataConsumers.delete(dataConsumer.id);
      dataConsumer.close();
    });

    return {
      id: dataConsumer.id,
      dataProducerId,
      sctpStreamParameters: dataConsumer.sctpStreamParameters,
      label: dataConsumer.label,
      protocol: dataConsumer.protocol,
    };
  }

  async resumeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error('Consumer not found');
    }

    await consumer.resume();
  }

  async pauseConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error('Consumer not found');
    }

    await consumer.pause();
  }

  async closeProducer(producerId: string): Promise<void> {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);
    }
  }

  async closeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(consumerId);
    }
  }

  async closeDataProducer(dataProducerId: string): Promise<void> {
    const dataProducer = this.dataProducers.get(dataProducerId);
    if (dataProducer) {
      dataProducer.close();
      this.dataProducers.delete(dataProducerId);
    }
  }

  async closeDataConsumer(dataConsumerId: string): Promise<void> {
    const dataConsumer = this.dataConsumers.get(dataConsumerId);
    if (dataConsumer) {
      dataConsumer.close();
      this.dataConsumers.delete(dataConsumerId);
    }
  }

  async closeTransport(socketId: string): Promise<void> {
    const transport = this.transports.get(socketId);
    if (transport) {
      transport.close();
      this.transports.delete(socketId);
    }

    // 関連するproducerとconsumerも削除
    for (const [id, producer] of this.producers.entries()) {
      if (producer.appData.socketId === socketId) {
        producer.close();
        this.producers.delete(id);
      }
    }

    for (const [id, consumer] of this.consumers.entries()) {
      if (consumer.appData.socketId === socketId) {
        consumer.close();
        this.consumers.delete(id);
      }
    }
  }

  getRouterCapabilities(): any {
    if (!this.router) {
      throw new Error('Router not initialized');
    }
    return this.router.rtpCapabilities;
  }

  async close(): Promise<void> {
    if (this.worker) {
      this.worker.close();
    }
  }

  // トランスポート統計を取得
  async getTransportStats(): Promise<{
    total: number;
    active: number;
    connected: number;
    dtlsStates: Record<string, number>;
    iceStates: Record<string, number>;
    dataProducers: number;
    dataConsumers: number;
    details: any[];
  }> {
    const stats = {
      total: this.transports.size,
      active: 0,
      connected: 0,
      dtlsStates: {} as Record<string, number>,
      iceStates: {} as Record<string, number>,
      dataProducers: this.dataProducers.size,
      dataConsumers: this.dataConsumers.size,
      details: [] as any[]
    };

    for (const [socketId, transport] of this.transports) {
      try {
        const transportStats = await transport.getStats();
        const dtlsState = (transport as any).dtlsState || 'unknown';
        const iceState = (transport as any).iceState || 'unknown';

        // 状態カウント
        stats.dtlsStates[dtlsState] = (stats.dtlsStates[dtlsState] || 0) + 1;
        stats.iceStates[iceState] = (stats.iceStates[iceState] || 0) + 1;

        if (dtlsState === 'connected') stats.connected++;
        if (dtlsState !== 'closed') stats.active++;

        stats.details.push({
          socketId,
          transportId: transport.id,
          dtlsState,
          iceState,
          bytesReceived: (transportStats as any).bytesReceived || 0,
          bytesSent: (transportStats as any).bytesSent || 0,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Failed to get stats for transport ${socketId}:`, error);
      }
    }

    return stats;
  }

  // 特定のクライアントのトランスポート統計を取得
  async getClientTransportStats(socketId: string): Promise<any | null> {
    const transport = this.transports.get(socketId);
    if (!transport) {
      return null;
    }

    try {
      const transportStats = await transport.getStats();
      const dtlsState = (transport as any).dtlsState || 'unknown';
      const iceState = (transport as any).iceState || 'unknown';

      // データプロデューサー/コンシューマー情報
      const clientDataProducers = Array.from(this.dataProducers.entries())
        .filter(([_, producer]) => producer.appData.socketId === socketId)
        .map(([id, producer]) => ({
          id,
          label: producer.label,
          protocol: producer.protocol,
          sctpStreamParameters: producer.sctpStreamParameters
        }));

      const clientDataConsumers = Array.from(this.dataConsumers.entries())
        .filter(([_, consumer]) => consumer.appData.socketId === socketId)
        .map(([id, consumer]) => ({
          id,
          label: consumer.label,
          protocol: consumer.protocol,
          sctpStreamParameters: consumer.sctpStreamParameters
        }));

      return {
        socketId,
        transportId: transport.id,
        dtlsState,
        iceState,
        dtlsParameters: transport.dtlsParameters,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        stats: transportStats,
        dataProducers: clientDataProducers,
        dataConsumers: clientDataConsumers,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to get client stats for ${socketId}:`, error);
      throw error;
    }
  }

  private getLocalIpAddress(): string {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // IPv4で内部ネットワークでないものを探す
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    
    // フォールバック
    return '127.0.0.1';
  }
}
