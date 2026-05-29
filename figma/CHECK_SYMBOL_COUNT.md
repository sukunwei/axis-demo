# Hyperliquid Symbol 數量檢查

讓我檢查實際有多少個 symbols：

## 方法 1: 手動計數後端 TRACKED_SYMBOLS 數組

```bash
# 數後端的 symbols
grep -o "'[A-Z0-9]*'" backend/src/server.ts | wc -l

# 數前端的 symbols  
grep -o "'[A-Z0-9]*'" src/hooks/useMockWebSocket.ts | wc -l
```

## 方法 2: 使用 Node.js 計算

```javascript
const TRACKED_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'ARB', 'MATIC', 'AVAX', 'OP', 'ATOM', 'DOGE', 'LTC',
  // ... 等等
];

console.log(TRACKED_SYMBOLS.length);
```

## Hyperliquid 實際支持的市場

根據 Hyperliquid 官方文檔：
- Hyperliquid 是一個去中心化永續合約交易所
- 截至 2024 年，支持 **100+ 永續合約市場**
- 包括主流幣、DeFi 代幣、meme 幣等

## 我的實現狀況

檢查中...
