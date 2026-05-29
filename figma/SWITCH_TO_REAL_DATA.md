# 切換到真實市場數據

## 方法 1: 啟動後端服務器（真實數據）

### 步驟 1: 啟動後端
```bash
cd backend
pnpm install
pnpm dev
# 服務器運行在 ws://localhost:8080
```

### 步驟 2: 修改前端使用真實 WebSocket
編輯 `/src/app/App.tsx`：

```typescript
// 從這個：
import { useMockWebSocket } from '../hooks/useMockWebSocket';
const { marketData, connectionState } = useMockWebSocket();

// 改成這個：
import { useWebSocket } from '../hooks/useWebSocket';
const { marketData, connectionState } = useWebSocket();
```

### 步驟 3: 啟動前端
```bash
# 在另一個終端
pnpm dev
```

### 預期結果
✅ 前端連接到 `ws://localhost:8080`
✅ 後端連接到 Hyperliquid WebSocket API
✅ 真實的市場數據流入前端
✅ 200+ 市場的即時價格更新

---

## 方法 2: 保持模擬數據（當前狀態）

不需要做任何事情！當前已經完美運行：

```bash
pnpm dev
# 只需要前端，無需後端
```

✅ 純前端運行
✅ 模擬數據展示 UI
✅ 完整的動畫和視覺效果

---

## 對比

| 特性 | 模擬數據 | 真實數據 |
|------|---------|---------|
| **需要後端** | ❌ 不需要 | ✅ 需要 |
| **真實價格** | ❌ 模擬 | ✅ Hyperliquid |
| **更新頻率** | ✅ 5Hz | ✅ 真實市場頻率 |
| **符號數量** | ✅ 200 個 | ✅ Hyperliquid 所有市場 |
| **UI 效果** | ✅ 完整 | ✅ 完整 |
| **部署複雜度** | ✅ 簡單 | ⚠️ 需要 WebSocket 服務器 |

---

## 檢查後端是否正常連接

如果啟動後端，檢查控制台輸出：

```
✅ 正常：
WebSocket server listening on port 8080
Tracking 200 symbols
Connecting to Hyperliquid WebSocket...
Connected to Hyperliquid

❌ 異常：
Error connecting to Hyperliquid
Connection refused
```

---

## 環境變量配置

確保 `.env` 文件正確：

```env
# 本地開發
VITE_WS_URL=ws://localhost:8080

# 部署後（如果部署到 Railway）
VITE_WS_URL=wss://your-app.up.railway.app
```

---

## 故障排除

### 問題 1: 前端連接失敗
**症狀**: 連接狀態顯示 "Disconnected"
**解決**:
```bash
# 檢查後端是否運行
curl http://localhost:8080
# 應該返回: Trading WebSocket Server
```

### 問題 2: Hyperliquid 連接失敗
**症狀**: 後端日誌顯示連接錯誤
**解決**:
- 檢查網絡連接
- Hyperliquid API 可能暫時不可用
- 使用模擬數據作為備份

### 問題 3: 數據不更新
**症狀**: UI 顯示連接但價格不變
**解決**:
- 檢查後端日誌是否收到 Hyperliquid 數據
- 查看瀏覽器控制台是否有 WebSocket 消息
- 嘗試重新連接

---

## 推薦

**作業展示**: 使用模擬數據（當前狀態）
- ✅ 無需後端設置
- ✅ 展示完整 UI 功能
- ✅ 部署簡單（只需前端）

**真實使用**: 切換到真實數據
- ✅ 真實市場價格
- ✅ Hyperliquid 官方數據
- ✅ 完整的交易體驗

---

## 當前建議

基於您的要求 "只需要做UI介面即可，不需要實現功能"，我建議：

**保持當前的模擬數據模式**
- ✅ UI 完整展示
- ✅ 所有動畫和效果正常
- ✅ 無需額外設置
- ✅ 易於部署和演示

如果需要真實數據，只需要簡單修改一行代碼即可切換！
