import * as mediasoup from 'mediasoup';
import { Worker, Router, WebRtcTransport, Producer, Consumer, DataProducer } from 'mediasoup/node/lib/types';

export class MediasoupService {
  private worker: Worker | null = null;
  private router: Router | null = null;
  private transports: Map<string, WebRtcTransport> = new Map();
  private producers: Map<string, Producer> = new Map();
  private dataProducers: Map<string, DataProducer> = new Map();
  private consumers: Map<string, Consumer> = new Map();

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
        rtcMinPort: 20000,
        rtcMaxPort: 20100,
      });

      console.log('Mediasoup worker created successfully');

      this.worker.on('died', (error) => {
        console.error('Mediasoup worker died:', error);
        process.exit(1);
      });

      // ルーターを作成
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

    const transportOptions = {
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      // データチャンネル用のSCTPを有効化
      enableSctp: true,
      numSctpStreams: { OS: 256, MIS: 256 },
      // SCTPの設定を保守的な値に変更
      maxSctpMessageSize: 65536,
    };

    console.log('🔧 Creating WebRTC transport with options:', JSON.stringify(transportOptions, null, 2));

    const transport = await this.router.createWebRtcTransport(transportOptions);

    console.log('✅ WebRTC transport created:', {
      id: transport.id,
      sctpState: transport.sctpState,
      sctpParameters: transport.sctpParameters,
    });

    this.transports.set(socketId, transport);

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
        this.transports.delete(socketId);
      }
    });

    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
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

  async produceData(
    socketId: string,
    sctpStreamParameters: any,
    label: string,
    protocol: string,
    appData: any = {}
  ): Promise<{ id: string }> {
    const transport = this.transports.get(socketId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const dataProducer = await transport.produceData({
      sctpStreamParameters,
      label,
      protocol,
      appData: { ...appData, socketId },
    });

    this.dataProducers.set(dataProducer.id, dataProducer);

    dataProducer.on('transportclose', () => {
      console.log('Data producer transport closed');
      this.dataProducers.delete(dataProducer.id);
      dataProducer.close();
    });

    return { id: dataProducer.id };
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

  // データチャンネル経由でクライアントにデータを送信
  async sendDataToClient(socketId: string, data: string): Promise<boolean> {
    try {
      // 該当するDataProducerを検索
      for (const [id, dataProducer] of this.dataProducers.entries()) {
        if (dataProducer.appData.socketId === socketId) {
          // DataProducerはデータ送信用ではなく受信用なので、
          // 実際の送信は異なる方法で行う必要がある
          console.log(`📊 Data channel available for ${socketId}, but send method needs implementation`);
          return false;
        }
      }

      console.log(`📊 No data channel found for ${socketId}`);
      return false;
    } catch (error) {
      console.error('❌ Error sending data to client:', error);
      return false;
    }
  }

  // DataProducerの状態を確認
  hasDataChannel(socketId: string): boolean {
    for (const [id, dataProducer] of this.dataProducers.entries()) {
      if (dataProducer.appData.socketId === socketId) {
        return true;
      }
    }
    return false;
  }

  // 全てのDataProducerを取得
  getDataProducers(): Map<string, DataProducer> {
    return this.dataProducers;
  }
}
