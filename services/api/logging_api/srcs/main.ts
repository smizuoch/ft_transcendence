import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs/promises';
import path from 'path';

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      },
    },
  },
});

// CORS設定
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

// ログディレクトリのパス
const LOG_DIR = '/host/logs';

// ログ書き込みのタイプ定義
interface LogEntry {
  service: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, any>;
}

interface NginxAccessLog {
  ip: string;
  user?: string;
  timestamp: string;
  method: string;
  path: string;
  httpVersion: string;
  status: number;
  bytes: number;
  referer?: string;
  userAgent: string;
}

interface SystemLog {
  timestamp: string;
  host: string;
  service: string;
  pid?: number;
  message: string;
}

// ログディレクトリが存在することを確認
async function ensureLogDirectory() {
  try {
    await fs.access(LOG_DIR);
  } catch {
    await fs.mkdir(LOG_DIR, { recursive: true });
  }
}

// ヘルスチェックエンドポイント
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// サービスログ書き込みエンドポイント（auth-service, game-service用）
fastify.post<{
  Body: LogEntry;
  Params: { service: string }
}>('/api/logs/:service', async (request, reply) => {
  const { service } = request.params;
  const logEntry = request.body;

  // 許可されたサービス名のチェック（frontendを追加）
  const allowedServices = ['auth', 'game', 'user_search', 'result_search', 'friend_search', 'frontend'];
  if (!allowedServices.includes(service)) {
    return reply.status(400).send({ error: 'Invalid service name' });
  }

  const timestamp = new Date().toISOString();
  const logLine = JSON.stringify({
    timestamp,
    level: logEntry.level,
    service: logEntry.service || service,
    message: logEntry.message,
    ...logEntry.metadata,
  });

  const logFilePath = path.join(LOG_DIR, `${service}-service.log`);

  try {
    await fs.appendFile(logFilePath, logLine + '\n');
    fastify.log.info(`Log written to ${service}-service.log`);
    return { success: true, timestamp };
  } catch (error) {
    fastify.log.error(`Failed to write log to ${service}-service.log:`, error);
    return reply.status(500).send({ error: 'Failed to write log' });
  }
});

// Nginxアクセスログ書き込みエンドポイント
fastify.post<{ Body: NginxAccessLog }>('/api/logs/nginx/access', async (request, reply) => {
  const accessLog = request.body;

  // Apache Combined Log Format
  const user = accessLog.user || '-';
  const referer = accessLog.referer || '-';
  const logLine = `${accessLog.ip} - ${user} [${accessLog.timestamp}] "${accessLog.method} ${accessLog.path} HTTP/${accessLog.httpVersion}" ${accessLog.status} ${accessLog.bytes} "${referer}" "${accessLog.userAgent}"`;

  const logFilePath = path.join(LOG_DIR, 'nginx-access.log');

  try {
    await fs.appendFile(logFilePath, logLine + '\n');
    fastify.log.info('Nginx access log written');
    return { success: true };
  } catch (error) {
    fastify.log.error('Failed to write nginx access log:', error);
    return reply.status(500).send({ error: 'Failed to write log' });
  }
});

// Nginxエラーログ書き込みエンドポイント
fastify.post<{ Body: { level: string; pid: number; tid: number; message: string; connectionId?: number } }>('/api/logs/nginx/error', async (request, reply) => {
  const errorLog = request.body;

  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const connectionPart = errorLog.connectionId ? `*${errorLog.connectionId} ` : '';
  const logLine = `${timestamp} [${errorLog.level}] ${errorLog.pid}#${errorLog.tid}: ${connectionPart}${errorLog.message}`;

  const logFilePath = path.join(LOG_DIR, 'nginx-error.log');

  try {
    await fs.appendFile(logFilePath, logLine + '\n');
    fastify.log.info('Nginx error log written');
    return { success: true };
  } catch (error) {
    fastify.log.error('Failed to write nginx error log:', error);
    return reply.status(500).send({ error: 'Failed to write log' });
  }
});

// システムログ書き込みエンドポイント
fastify.post<{ Body: SystemLog }>('/api/logs/system', async (request, reply) => {
  const systemLog = request.body;

  const pidPart = systemLog.pid ? `[${systemLog.pid}]` : '';
  const logLine = `${systemLog.timestamp} ${systemLog.host} ${systemLog.service}${pidPart}: ${systemLog.message}`;

  const logFilePath = path.join(LOG_DIR, 'system.log');

  try {
    await fs.appendFile(logFilePath, logLine + '\n');
    fastify.log.info('System log written');
    return { success: true };
  } catch (error) {
    fastify.log.error('Failed to write system log:', error);
    return reply.status(500).send({ error: 'Failed to write log' });
  }
});

// ログファイル一覧取得エンドポイント
fastify.get('/api/logs', async () => {
  try {
    const files = await fs.readdir(LOG_DIR);
    const logFiles = files.filter(file => file.endsWith('.log'));
    return { files: logFiles };
  } catch (error) {
    fastify.log.error('Failed to read log directory:', error);
    return { files: [] };
  }
});

// ログファイル内容取得エンドポイント（最新N行）
fastify.get<{
  Params: { filename: string };
  Querystring: { lines?: string }
}>('/api/logs/:filename', async (request, reply) => {
  const { filename } = request.params;
  const lines = parseInt(request.query.lines || '100');

  // セキュリティ: ファイル名検証
  if (!filename.endsWith('.log') || filename.includes('/') || filename.includes('..')) {
    return reply.status(400).send({ error: 'Invalid filename' });
  }

  const logFilePath = path.join(LOG_DIR, filename);

  try {
    const content = await fs.readFile(logFilePath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim() !== '');
    const recentLines = allLines.slice(-lines);

    return {
      filename,
      totalLines: allLines.length,
      returnedLines: recentLines.length,
      content: recentLines,
    };
  } catch (error) {
    fastify.log.error(`Failed to read log file ${filename}:`, error);
    return reply.status(404).send({ error: 'Log file not found' });
  }
});

// サーバー起動
const start = async () => {
  try {
    await ensureLogDirectory();
    await fastify.listen({ port: 3005, host: '0.0.0.0' });
    fastify.log.info('Logging API server is running on http://0.0.0.0:3005');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
