# Skill API 部署指南

**目标**: 快速部署 skill API 服务，让其他用户能够接入

---

## 🚀 快速开始

### 1. 安装依赖

```powershell
npm install express cors helmet express-rate-limit
```

### 2. 启动服务

```powershell
node skill-api-server.js
```

### 3. 测试 API

```powershell
# 健康检查
curl http://localhost:3000/health

# 代码检测
curl -X POST http://localhost:3000/v1/skills/code-detector/analyze \
  -H "Authorization: Bearer sk-test-key-123" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"eval(userInput)\",\"language\":\"javascript\"}"
```

---

## 📦 生产部署

### 使用 Docker

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "skill-api-server.js"]
```

#### 构建和运行
```powershell
# 构建镜像
docker build -t skill-api:latest .

# 运行容器
docker run -d -p 3000:3000 --name skill-api skill-api:latest
```

---

### 使用 PM2

```powershell
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start skill-api-server.js --name skill-api

# 查看日志
pm2 logs skill-api

# 重启服务
pm2 restart skill-api

# 停止服务
pm2 stop skill-api
```

---

## 🔧 环境变量配置

创建 `.env` 文件：

```env
# 服务配置
PORT=3000
NODE_ENV=production

# 数据库配置（如果需要）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=skill_api
DB_USER=postgres
DB_PASSWORD=your-password

# 认证配置
JWT_SECRET=your-jwt-secret
API_KEY_SALT=your-api-key-salt

# Redis 配置（用于频率限制）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

---

## 📊 监控和日志

### 日志配置

```javascript
// 添加日志中间件
const morgan = require('morgan')
app.use(morgan('combined'))
```

### 健康检查

```powershell
# 检查服务状态
curl http://localhost:3000/health

# 预期响应
{
  "status": "ok",
  "timestamp": "2026-08-01T12:00:00Z"
}
```

---

## 📖 API 文档

### 在线文档

推荐使用 Swagger/OpenAPI：

```powershell
npm install swagger-ui-express
```

```javascript
const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')

const swaggerDocument = YAML.load('./swagger.yaml')

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
```

---

## 🛡️ 安全建议

### 1. 使用 HTTPS

```javascript
const https = require('https')
const fs = require('fs')

const options = {
  key: fs.readFileSync('private.key'),
  cert: fs.readFileSync('certificate.crt')
}

https.createServer(options, app).listen(443)
```

### 2. 配置 CORS

```javascript
app.use(cors({
  origin: ['https://your-frontend.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
```

### 3. 输入验证

```javascript
const { body, validationResult } = require('express-validator')

app.post('/v1/skills/code-detector/analyze',
  body('code').isString().notEmpty(),
  body('language').optional().isIn(['javascript', 'python', 'typescript']),
  (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    // 处理请求
  }
)
```

---

## 📈 性能优化

### 1. 使用缓存

```javascript
const NodeCache = require('node-cache')
const cache = new NodeCache({ stdTTL: 100 })

// 缓存中间件
function cacheMiddleware(req, res, next) {
  const key = req.originalUrl
  const cached = cache.get(key)

  if (cached) {
    return res.json(cached)
  }

  res.sendResponse = res.json
  res.json = (body) => {
    cache.set(key, body)
    res.sendResponse(body)
  }

  next()
}
```

### 2. 压缩响应

```javascript
const compression = require('compression')
app.use(compression())
```

### 3. 连接池

```javascript
const { Pool } = require('pg')

const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})
```

---

## 🧪 测试

### 单元测试

```javascript
const request = require('supertest')
const app = require('./skill-api-server')

describe('Code Detector API', () => {
  it('should detect dangerous code', async () => {
    const response = await request(app)
      .post('/v1/skills/code-detector/analyze')
      .set('Authorization', 'Bearer sk-test-key-123')
      .send({ code: 'eval(userInput)', language: 'javascript' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.safe).toBe(false)
  })
})
```

---

## 🚀 扩展功能

### 1. 数据库集成

```javascript
const { Pool } = require('pg')

const pool = new Pool()

// API Key 管理
async function getAPIKey(key) {
  const result = await pool.query(
    'SELECT * FROM api_keys WHERE key = $1 AND active = true',
    [key]
  )
  return result.rows[0]
}
```

### 2. Redis 缓存

```javascript
const redis = require('redis')
const client = redis.createClient()

// 频率限制
async function checkRateLimit(apiKey) {
  const key = `ratelimit:${apiKey}`
  const count = await client.incr(key)

  if (count === 1) {
    await client.expire(key, 3600) // 1 小时
  }

  return count <= 1000 // 最多 1000 次
}
```

### 3. 消息队列

```javascript
const amqp = require('amqplib')

async function sendToQueue(task) {
  const connection = await amqp.connect('amqp://localhost')
  const channel = await connection.createChannel()

  await channel.assertQueue('tasks')
  await channel.sendToQueue('tasks', Buffer.from(JSON.stringify(task)))
}
```

---

## 📞 后续步骤

1. **开发 API** - 实现核心功能
2. **编写文档** - 提供完整文档和示例
3. **测试验证** - 确保功能正确
4. **部署上线** - 生产环境部署
5. **监控运维** - 持续监控和优化

---

**一句话总结**: **使用 Node.js + Express 快速搭建 skill API，让其他用户能够轻松接入！**