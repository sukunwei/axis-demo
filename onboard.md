# axis-demo — Agent Onboard

> **用途**：Claude CLI / AI 编码代理进入本仓时**第一必读**，建立业务目标与工程约束的统一理解。  
> **技术细节**：第二必读 `CLAUDE.md`；**执行步骤**：第三必读 `docs/dev-plan.md`。

---

## 1. 项目是什么

**axis-demo** 是 Axis 前端面试作业：构建 **Web 版实时 Watchlist + 模拟 Portfolio**，通过 **自建后端 WebSocket** 推送字段级 diff，满足断线回填、批量、背压与 60fps 数字动画等要求。

- **市场**：Hyperliquid 永续（后端单连接 `allMids`）；开发/压测可用 **Mock Feed**（200+ 标的）
- **交付**：GitHub 公仓、Railway 后端 + Vercel 前端（或 `docker-compose up`）、README、Design Decisions、3–5 分钟演示
- **原型素材**：`figma/` 为 Figma Make 导出（UI 可参考），**不得**沿用其「前端直连 HL」的数据链路

---

## 2. 硬性约束（违反 = 作业核心分丢失）

| 约束 | 说明 |
|------|------|
| 前端不直连 HL | 浏览器只连 `VITE_WS_URL`（自家 backend） |
| 后端 diff-only | 只推变更字段 + 50–100ms 批量 |
| reconnect | 客户端 `hello(lastSeq)` + ring buffer 回放 / 超窗 snapshot |
| MobX 行级更新 | 列表不 observer；`PriceCell` 等最小单元 observer |
| 后台恢复 | `visibilitychange` 后 reconcile，禁止整页 reload |

作业全文见 `docs/axis.md`。

---

## 3. 文档地图

| 文件 | 内容 |
|------|------|
| `docs/dev-plan.md` | **分 Phase 开发计划**（Claude CLI 执行主依据） |
| `docs/axis.md` | 面试需求与评分项 |
| `docs/technical-doc.md` / `technical-solution.md` | 历史方案（与 dev-plan 冲突时 **以 dev-plan 为准**） |
| `docs/hyperliquid-api-doc.md` | HL API 参考（仅后端 Feed 使用） |
| `docs/api-protocol.md` | 前后端 WS 协议（Phase 0 创建） |
| `docs/DESIGN_DECISIONS.md` | 交付时设计说明（Phase 6） |
| `CLAUDE.md` | 编码规范与目录约定 |

---

## 4. 目标目录（实现后）

```
frontend/          # Vite + React + MobX + Tailwind
backend/           # Node + ws + mock|hyperliquid feed
docs/
figma/             # 只读素材，不提交业务改动到此目录
```

MobX 注入模式与团队 `react-app` 对齐：

- `stores/store-instances.ts` — 单例 `{ marketStore, portfolioStore, connectionStore }`
- `stores/useStore.ts` — `StoreContext` + `useStore()`
- `stores/StoreProvider.tsx` — 包裹 `App`

---

## 5. Agent 典型执行顺序

1. 读 **本文件** + `CLAUDE.md`
2. 读 `docs/dev-plan.md`，确认当前应执行的 **Phase**
3. 仅修改 `frontend/`、`backend/`、`docs/`（不从 `figma/` 原地改）
4. Phase 结束：跑该 Phase 的「验证命令」，更新 `dev-plan.md`  checkbox
5. 协议变更：同步 `docs/api-protocol.md` 与两端 `protocol.ts`

---

## 6. 常用命令（monorepo 建成后）

```bash
pnpm install
pnpm --filter backend dev      # 默认 FEED_MODE=mock
pnpm --filter frontend dev     # VITE_WS_URL=ws://localhost:8080
pnpm --filter backend test
pnpm -r exec tsc --noEmit      # 或各包 lint:ts
docker compose up              # 一键本地（Phase 6）
```

---

## 7. 与 react-app 的关系

本仓**借鉴** `fe-project/react-app/react-app` 的：

- `CLAUDE.md` / `.claudeignore` 协作配置
- `stores/store-instances` + `StoreProvider` + `useStore` MobX 注入
- `WsManager` 重连/心跳思路（协议改为 axis `hello`/`diff`/`snapshot`）

**不借鉴**：Next.js、前端直连 OKX/HL、SharedWorker、SDD 插件。

---

## 8. 当前状态

- [ ] monorepo `frontend/` + `backend/` 尚未初始化 → 从 **dev-plan Phase 0** 开始
- [x] `docs/dev-plan.md`、`CLAUDE.md`、`onboard.md` 已就绪
- [x] `figma/` 原型可作 UI 迁移来源
