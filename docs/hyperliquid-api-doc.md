# Hyperliquid API 学习结论

## 1. API 概览

### Base URLs

| 环境 | URL |
|------|-----|
| Mainnet | `https://api.hyperliquid.xyz` |
| Testnet | `https://api.hyperliquid-testnet.xyz` |
| WebSocket Mainnet | `wss://api.hyperliquid.xyz/ws` |
| WebSocket Testnet | `wss://api.hyperliquid-testnet.xyz/ws` |

### 核心端点

```
POST https://api.hyperliquid.xyz/info
Content-Type: application/json
```

---

## 2. Info API（行情数据）

### 2.1 关键方法一览

| 方法 | 用途 |
|------|------|
| `allMids` | 获取所有币种的最新价格（中间价） |
| `l2Book` | L2 订单簿快照（最深20档） |
| `candleSnapshot` | K线数据（支持1m-1M间隔） |
| `trades` | 实时成交（需 WebSocket 订阅） |
| `openOrders` | 用户当前挂单 |
| `userFills` | 用户成交记录（最近2000条） |
| `userRateLimit` | API 速率限制查询 |

### 2.2 allMids 示例（与本项目直接相关）

```json
// Request
{ "type": "allMids" }

// Response
{
  "APE": "4.33245",
  "ARB": "1.21695",
  "BTC": "113377.0",
  "ETH": "2412.7",
  ...
}
```

**特点：**
- 返回所有币种的中间价（mid price）
- 对于空单，最后成交价作为备用
- 包含现货和合约的 mids
- **这是本项目后端接入行情数据的核心接口**

### 2.3 l2Book 订单簿

```json
// Request
{ "type": "l2Book", "coin": "BTC" }

// Response
{
  "coin": "BTC",
  "time": 1754450974231,
  "levels": [
    [{"px": "113377.0", "sz": "7.6699", "n": 17}],  // asks
    [{"px": "113376.0", "sz": "3.1245", "n": 8}]   // bids
  ]
}
```

---

## 3. WebSocket API（实时数据）

### 3.1 连接方式

```bash
wscat -c wss://api.hyperliquid.xyz/ws
```

### 3.2 订阅格式

```json
// 订阅
{ "method": "subscribe", "subscription": { "type": "allMids" } }

// 取消订阅
{ "method": "unsubscribe", "subscription": { "type": "allMids" } }

// 服务器响应
{ "channel": "subscriptionResponse", "data": {...} }
```

### 3.3 与本项目相关的订阅类型

| 类型 | 数据内容 |
|------|----------|
| `allMids` | 所有币种中间价实时更新 |
| `l2Book` | 订单簿更新 |
| `trades` | 实时成交 |
| `candle` | K线数据（可指定1m/5m/1h等间隔） |
| `bbo` | 最佳买卖价 |
| `userFills` | 用户成交（需认证） |
| `userFundings` | 用户资金费率 |

### 3.4 重要说明

> **"All automated users should handle disconnects from the server side and gracefully reconnect."**

- 服务器可能随时断开，不一定会通知
- 断连重连后，快照 ack 中会包含遗漏的数据
- 用户可通过相应的 info 请求手动查询遗漏数据

---

## 4. 与本项目作业的结合点

### 4.1 数据源选择

**选择 Hyperliquid 的理由：**
- WebSocket 提供 `allMids` 订阅，可以实时获取所有币种价格
- 相比 Polymarket，Hyperliquid 覆盖更多交易对（永续合约为主）
- API 文档完善，有官方 Python SDK 支持

### 4.2 实现方案

#### 后端数据流设计

```
Hyperliquid WS (allMids订阅)
    ↓
Node.js Aggregator Service
    ↓ (100ms batch)
Ring Buffer (存储最近 seq)
    ↓
WebSocket Hub (广播给前端)
```

#### 关键代码模板

**订阅 allMids：**
```javascript
const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({
    method: 'subscribe',
    subscription: { type: 'allMids' }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.channel === 'allMids') {
    // msg.data 是 { "BTC": "113377.0", "ETH": "2412.7", ... }
    Object.entries(msg.data).forEach(([symbol, price]) => {
      pendingUpdates.set(symbol, price);
    });
  }
});
```

### 4.3 性能考量

1. **Batching**：Hyperliquid 的 `allMids` 可能每秒推送多次，需要在后端做 100ms 批处理
2. **只取 diff**：前端 MobX Store 只更新变化的 symbol
3. **Ring Buffer**：存储 seq + diff，支持断线重连回放

### 4.4 连接状态处理

根据 Hyperliquid 文档的建议：

```javascript
class ConnectionManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
  }

  connect() {
    this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    this.ws.on('close', () => {
      this.handleDisconnect();
    });

    this.ws.on('error', (error) => {
      console.error('WS Error:', error);
    });
  }

  handleDisconnect() {
    // Exponential backoff 重连
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
}
```

---

## 5. 与作业要求的对应关系

### 前端要求

| 作业要求 | Hyperliquid 对应方案 |
|--------|---------------------|
| 30 symbols @ 5Hz 保持 60fps | `allMids` WebSocket 订阅 + MobX 原子化更新 |
| 数字动画 + 颜色闪烁 | CSS transition + RAF 插值 |
| 已连接/重连中/数据停滞 | ConnectionManager 状态机 |
| 后台30秒恢复 | Visibility API + 重连后获取 snapshot |

### 后端要求

| 作业要求 | Hyperliquid 对应方案 |
|--------|---------------------|
| diff-only 更新 | 增量更新 only changed fields |
| 50-100ms 批量 | setInterval(100ms) 聚合 pendingUpdates |
| 断线重连回放 | Ring Buffer 存储 seq + data |
| Ring buffer 超窗口返回 snapshot | 超出范围的 seq 返回全量 `allMids` |

---

## 6. 已知限制与注意事项

1. **断开处理**：必须实现自动重连逻辑
2. **速率限制**：注意 `userRateLimit` 查询
3. **数据一致性**：重连后需要从 snapshot 开始对齐
4. **测试网可用**：可先用 testnet 测试

---

## 7. 下一步行动

- [ ] 基于 Hyperliquid WebSocket `allMids` 实现后端 feed generator
- [ ] 实现 100ms batching 的 Aggregator Service
- [ ] 实现 Ring Buffer + seq 回放机制
- [ ] 实现前端 MobX Store 与 WebSocket 客户端
- [ ] 测试断线重连与数据恢复
