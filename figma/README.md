# Hyperliquid 交易投資組合與監視列表 UI

這是一個專業的交易界面 UI 展示專案，展示了即時價格更新、投資組合追蹤和市場數據視覺化的設計。

![Trading UI Demo](https://img.shields.io/badge/Status-UI_Demo-blue)
![React](https://img.shields.io/badge/React-18.3.1-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![Tailwind](https://img.shields.io/badge/Tailwind-4.1-38bdf8)

## 🎨 功能特點

### 📊 即時市場監視列表
- **200+ 市場追蹤**：涵蓋 BTC、ETH、SOL 等主流幣種
- **平滑動畫**：60fps 數字過渡效果，無跳動
- **顏色指示**：綠色上漲、紅色下跌的即時視覺反饋
- **虛擬滾動**：高效能渲染大型列表
- **價格走勢圖**：迷你圖表顯示即時價格趨勢
- **搜尋和排序**：快速找到目標市場

### 💼 投資組合追蹤
- **模擬持倉**：展示多幣種投資組合
- **即時損益計算**：每次價格更新自動重算 P&L
- **視覺化統計**：總價值、成本基礎、未實現損益
- **專業布局**：類似交易終端的界面設計

### 📈 資產詳情頁面
- **即時價格圖表**：使用 Recharts 顯示價格走勢
- **24 小時統計**：最高價、最低價、開盤價、成交量
- **優雅的設計**：漸層背景、卡片布局、動態指標

### 🎯 市場總覽
- **漲跌統計**：即時統計上漲和下跌的市場數量
- **總成交量**：顯示所有市場的 24 小時總成交量
- **平均變化**：市場整體情緒指標
- **頂級市場**：最大漲幅和跌幅的幣種

### ⚡ 連接狀態指示
- **已連接**（綠色）：正常運行，數據新鮮
- **重新連接中**（黃色）：正在嘗試重新連接
- **已斷開**（紅色）：無連接
- **數據過時**（橙色）：連接但無新數據

## 🛠 技術棧

### 前端框架
- **React 18.3.1** - 現代化 UI 框架
- **TypeScript** - 類型安全
- **Vite 6.3.5** - 快速構建工具

### UI 和樣式
- **Tailwind CSS v4** - 實用優先的 CSS 框架
- **Radix UI** - 無障礙訪問組件
- **Lucide React** - 精美的圖標庫
- **Motion** (Framer Motion) - 流暢動畫

### 數據視覺化
- **Recharts** - React 圖表庫
- **自定義 SVG** - 價格走勢迷你圖

### 狀態管理
- **React Hooks** - 本地狀態管理
- **自定義 Hooks** - 可重用邏輯

## 🚀 快速開始

### 前置要求
- Node.js 20+
- pnpm (推薦) 或 npm

### 安裝和運行

```bash
# 安裝依賴
pnpm install

# 啟動開發伺服器
pnpm dev

# 在瀏覽器中打開
# http://localhost:5173
```

### 構建生產版本

```bash
# 構建
pnpm build

# 預覽構建結果
pnpm preview
```

## 📁 專案結構

```
src/
├── app/
│   ├── App.tsx                 # 主應用組件
│   └── components/
│       └── ui/                 # Radix UI 組件庫
├── components/
│   ├── AnimatedNumber.tsx      # 動畫數字組件
│   ├── AssetDetail.tsx         # 資產詳情頁面
│   ├── ConnectionIndicator.tsx # 連接狀態指示器
│   ├── LoadingSpinner.tsx      # 載入動畫
│   ├── MarketOverview.tsx      # 市場總覽卡片
│   ├── Portfolio.tsx           # 投資組合視圖
│   ├── PriceSparkline.tsx      # 價格走勢迷你圖
│   └── Watchlist.tsx           # 監視列表視圖
├── hooks/
│   ├── useAnimatedNumber.ts    # 數字動畫 Hook
│   ├── useMockWebSocket.ts     # 模擬 WebSocket Hook
│   ├── usePriceHistory.ts      # 價格歷史 Hook
│   └── useWebSocket.ts         # WebSocket Hook（未使用）
├── types/
│   └── market.ts               # TypeScript 類型定義
└── styles/
    ├── animations.css          # 自定義動畫
    ├── fonts.css               # 字體設定
    ├── index.css               # 主樣式文件
    ├── tailwind.css            # Tailwind 基礎
    └── theme.css               # 主題變量
```

## 🎨 設計特點

### 動畫系統
- **RequestAnimationFrame**：確保 60fps 流暢動畫
- **三次緩動**：自然的數字過渡效果
- **顏色閃爍**：300ms 的方向指示
- **平滑過渡**：無跳動的價格更新

### 性能優化
- **虛擬滾動**：僅渲染可見項目
- **記憶化計算**：避免不必要的重新計算
- **批量更新**：減少渲染次數
- **優化的 re-renders**：使用 React.memo 和 useMemo

### 視覺設計
- **深色主題**：減少眼睛疲勞
- **漸層效果**：現代化美學
- **玻璃態效果**：背景模糊和透明度
- **霓虹發光**：強調重要元素
- **專業配色**：藍色/紫色漸層主題

## 🔧 配置

### 環境變量

創建 `.env` 文件：

```env
VITE_WS_URL=ws://localhost:8080
```

## 📊 UI 組件

### 監視列表
- 虛擬滾動表格，支持 200+ 項目
- 搜尋和排序功能
- 每行包含：符號、價格、變化、走勢圖、成交量
- 點擊行查看詳情

### 投資組合
- 投資組合總覽卡片
- 未實現損益追蹤
- 持倉列表，含成本基礎
- 點擊持倉查看資產詳情

### 資產詳情
- 即時價格圖表
- 24 小時統計卡片
- 返回導航
- 大型價格顯示

## 🎯 模擬數據

此專案使用模擬數據來展示 UI 功能：

- **200+ 加密貨幣符號**：涵蓋主流和迷因幣
- **模擬價格更新**：每 200ms 更新 10-30 個隨機市場
- **隨機價格變動**：-0.5% 到 +0.5% 的小幅波動
- **模擬投資組合**：10 個預設持倉

### 更新頻率
- 價格更新：5 Hz (每 200ms)
- 連接狀態檢查：每 10 秒
- 圖表數據：保留最近 100 個數據點

## 🌟 關鍵功能實現

### 平滑數字動畫
```typescript
const { displayValue, direction } = useAnimatedNumber(value, {
  duration: 300,
  decimals: 2
});
```

### 價格走勢圖
```typescript
const history = usePriceHistory(symbol, marketData);
// 自動收集和繪製 SVG 路徑
```

### 虛擬滾動
```typescript
const startIndex = Math.floor(scrollTop / itemHeight) - overscan;
const endIndex = Math.ceil((scrollTop + height) / itemHeight) + overscan;
// 僅渲染可見範圍內的項目
```

## 🎨 自定義樣式

### 漸層網格背景
```css
.gradient-mesh {
  background:
    radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.1) 0px, transparent 50%),
    /* ... 更多漸層 ... */;
}
```

### 玻璃效果
```css
.glass-effect {
  background: rgba(17, 24, 39, 0.8);
  backdrop-filter: blur(12px);
}
```

## 📝 使用說明

### 導航
1. **監視列表**：查看所有市場
2. **投資組合**：查看您的持倉
3. **點擊任何資產**：查看詳細信息
4. **搜尋框**：快速過濾符號
5. **列標題**：點擊排序

### 連接狀態
- 右上角顯示連接狀態
- 綠色圓點 = 實時更新中
- 底部顯示最後更新時間

## 🔮 未來增強

- [ ] 用戶認證
- [ ] 持久化投資組合
- [ ] 價格警報
- [ ] 多時間框架圖表
- [ ] 訂單簿深度
- [ ] 交易執行界面
- [ ] 推薦引擎
- [ ] 新聞和情緒數據

## 📄 許可證

MIT

## 🤝 貢獻

歡迎提交 Pull Request。對於重大更改，請先開啟 issue 討論。

---

**注意**：這是一個 UI 展示專案，使用模擬數據。不連接真實的交易 API。所有價格和交易數據均為模擬生成。
