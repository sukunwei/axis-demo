#!/bin/bash

echo "🚀 启动 Hyperliquid 真实数据模式"
echo ""
echo "步骤 1/3: 安装后端依赖..."
cd backend
pnpm install

echo ""
echo "步骤 2/3: 启动后端服务器（连接 Hyperliquid）..."
echo "后端将在 ws://localhost:8080 运行"
echo ""
echo "✅ 请在新终端运行前端："
echo "   pnpm dev"
echo ""
echo "✅ 然后修改 src/app/App.tsx："
echo "   import { useWebSocket } from '../hooks/useWebSocket';"
echo "   const { marketData, connectionState } = useWebSocket();"
echo ""
echo "启动后端..."
pnpm dev
