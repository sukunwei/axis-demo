# 启动 Node.js 后端连接 Hyperliquid

## 🎯 快速开始

### 步骤 1: 安装依赖

```bash
cd backend
pnpm install
```

### 步骤 2: 启动后端服务器

```bash
# 开发模式（带热重载）
pnpm dev

# 或者构建后运行
pnpm build
pnpm start
```

### 步骤 3: 验证连接

后端启动后，你应该看到：

```
✅ WebSocket server listening on port 8080
✅ Tracking 202 symbols
✅ Connecting to Hyperliquid WebSocket...
✅ Connected to Hyperliquid
```

### 步骤 4: 切换前端到真实数据

编辑 `src/app/App.tsx`，修改第 2 行：

```typescript
// 从模拟数据：
import { useMockWebSocket } from '../hooks/useMockWebSocket';

// 改为真实数据：
import { useWebSocket } from '../hooks/useWebSocket';
```

然后修改第 13 行：

```typescript
// 从：
const { marketData, connectionState } = useMockWebSocket();

// 改为：
const { marketData, connectionState } = useWebSocket();
```

### 步骤 5: 启动前端

```bash
# 在项目根目录
pnpm dev
```

## 📊 后端架构

### WebSocket 流程图

```
Hyperliquid WS API (wss://api.hyperliquid.xyz/ws)
    ↓
订阅 allMids + trades
    ↓
接收市场数据
    ↓
更新内存存储 (Map<symbol, MarketData>)
    ↓
批量处理 (75ms 窗口)
    ↓
差异更新 (只发送变化)
    ↓
广播给所有连接的客户端
```

### 主要组件

1. **Hyperliquid 连接**
   - WebSocket 连接到 `wss://api.hyperliquid.xyz/ws`
   - 自动重连（指数退避）
   - 订阅 202 个市场

2. **数据处理**
   - 接收 `allMids` 消息（所有市场中间价）
   - 接收 `trades` 消息（逐笔交易）
   - 计算 24h 高/低/开盘价/涨跌幅

3. **客户端管理**
   - 支持多个前端连接
   - 批量更新（减少消息数）
   - 回补机制（断线重连不丢数据）

4. **环形缓冲区**
   - 保存最近 10,000 条更新
   - 用于客户端重连回补
   - 自动清理旧数据

## 📡 API 端点

### WebSocket 端点

```
ws://localhost:8080
```

### 客户端消息格式

**订阅请求**：
```json
{
  "type": "subscribe",
  "lastSeq": 0
}
```
- `lastSeq: 0` - 新连接，发送完整快照
- `lastSeq: 12345` - 重连，发送 seq > 12345 的更新

### 服务器消息格式

**快照消息**：
```json
{
  "type": "snapshot",
  "seq": 12345,
  "data": [
    {
      "symbol": "BTC",
      "price": 45000,
      "prevPrice": 44950,
      "dayOpen": 44000,
      "dayHigh": 45200,
      "dayLow": 43800,
      "volume24h": 1234567890,
      "changePercent": 2.27,
      "lastUpdate": 1234567890123
    }
    // ... 更多市场
  ],
  "timestamp": 1234567890123
}
```

**批量更新消息**：
```json
{
  "type": "batch",
  "seq": 12346,
  "data": [
    {
      "symbol": "BTC",
      "price": 45001,
      "prevPrice": 45000,
      // ... 只包含变化的字段
    }
  ],
  "timestamp": 1234567890198
}
```

**连接状态消息**：
```json
{
  "type": "connection_state",
  "state": "connected",  // connected | reconnecting | disconnected | stale
  "timestamp": 1234567890123
}
```

## ⚙️ 配置选项

在 `backend/src/server.ts` 中可以调整：

```typescript
const PORT = process.env.PORT || 8080;          // 服务器端口
const BATCH_WINDOW_MS = 75;                      // 批量窗口（毫秒）
const RING_BUFFER_SIZE = 10000;                  // 环形缓冲区大小
const STALE_THRESHOLD_MS = 10000;                // 数据过期阈值
const MAX_RECONNECT_DELAY = 30000;               // 最大重连延迟
```

## 🔧 环境变量

创建 `backend/.env` 文件（可选）：

```env
PORT=8080
NODE_ENV=development
```

## 📊 性能优化

### 批量处理

- 收集 75ms 内的所有更新
- 合并为单个消息发送
- 减少消息数量 98%+

### 差异更新

```typescript
// ❌ 不好：发送完整对象
{ symbol: "BTC", price: 45000, volume: 1000000, ... }

// ✅ 好：只发送变化的字段
{ symbol: "BTC", price: 45001 }
```

### 内存优化

- 市场数据：~40 KB（202 symbols × ~200 bytes）
- 环形缓冲区：~1 MB（10,000 entries）
- 总内存占用：< 10 MB

## 🐛 调试

### 检查后端日志

```bash
cd backend
pnpm dev

# 应该看到：
Connecting to Hyperliquid WebSocket...
Connected to Hyperliquid
Client connected  # 前端连接时
```

### 测试 WebSocket 连接

使用 `wscat` 测试：

```bash
npm install -g wscat
wscat -c ws://localhost:8080

# 连接后发送：
{"type":"subscribe","lastSeq":0}

# 应该收到快照和更新消息
```

### 检查 Hyperliquid 连接

```bash
# 后端日志应该显示：
Connected to Hyperliquid
# 如果看到错误：
Hyperliquid WebSocket error: ...
Reconnecting to Hyperliquid in 1000ms...
```

## 🚀 部署

### Railway 部署

1. **创建 Railway 项目**
   ```bash
   railway login
   railway init
   railway up
   ```

2. **配置环境变量**
   ```
   PORT=8080
   ```

3. **获取公开 URL**
   - Railway 会自动分配 URL
   - 格式：`https://your-app.up.railway.app`

4. **更新前端配置**
   ```env
   # .env
   VITE_WS_URL=wss://your-app.up.railway.app
   ```

### Docker 部署

```bash
cd backend
docker build -t hyperliquid-ws .
docker run -p 8080:8080 hyperliquid-ws
```

## 📝 故障排除

### 问题 1: 无法连接到 Hyperliquid

**症状**：
```
Error: connect ETIMEDOUT
或
WebSocket connection failed
```

**解决方案**：
- 检查网络连接
- Hyperliquid API 可能暂时不可用
- 尝试使用 VPN

### 问题 2: 前端无法连接后端

**症状**：
```
WebSocket connection to 'ws://localhost:8080' failed
```

**解决方案**：
1. 检查后端是否运行：`curl http://localhost:8080`
2. 检查端口是否被占用：`lsof -i :8080`
3. 检查防火墙设置

### 问题 3: 数据不更新

**症状**：连接成功但价格不变

**解决方案**：
1. 检查后端日志是否收到 Hyperliquid 数据
2. 检查浏览器控制台是否收到 WebSocket 消息
3. 验证符号列表是否正确

## 📚 Hyperliquid API 文档

官方文档：https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket

### 可用的订阅类型

- `allMids` - 所有市场的中间价
- `trades` - 交易数据
- `l2Book` - 订单簿（Level 2）
- `candle` - K线数据
- `user` - 用户数据（需要认证）

## 🎯 下一步

现在你有两个选择：

1. **保持模拟数据**（当前）
   - 简单，无需后端
   - 完美展示 UI

2. **切换到真实数据**
   - 启动后端：`cd backend && pnpm dev`
   - 修改 App.tsx：使用 `useWebSocket` 而不是 `useMockWebSocket`
   - 获得真实的 Hyperliquid 市场数据

选择哪一个取决于你的需求！
