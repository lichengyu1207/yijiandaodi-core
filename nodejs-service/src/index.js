import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { uploadRouter } from './routes/upload.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '../uploads')));

app.use('/api/upload', uploadRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Node.js服务运行正常', service: 'fangdudu-nodejs-service' });
});

wss.on('connection', (ws) => {
  logger.info('WebSocket客户端已连接');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      logger.info('收到消息:', message);

      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      logger.error('消息解析失败:', error);
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket客户端断开连接');
  });

  ws.on('error', (error) => {
    logger.error('WebSocket错误:', error);
  });
});

server.listen(PORT, () => {
  logger.info(`✅ Node.js 服务启动成功`);
  logger.info(`📍 HTTP地址: http://localhost:${PORT}`);
  logger.info(`🔗 WebSocket: ws://localhost:${PORT}/ws`);
  logger.info(`📁 文件上传: http://localhost:${PORT}/api/upload`);
});
