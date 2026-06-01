# ASP.NET Core Web API 技术方案

> 用 ASP.NET Core 替换现有 Fastify + Prisma 后端，实现与前端完全兼容的 Todo List REST API。  
> 文档版本：2026-06-01（修订版）

---

## 概述

| 目标 | 说明 |
|------|------|
| **稳定替换** | API 路径、状态码、JSON 字段与现有 React 前端一致，Vite 代理即可切换后端 |
| **团队习惯** | 采用 **Controllers + Service**（MVC 风格），便于熟悉 ASP.NET 的同事维护与 Code Review |
| **运行时** | **.NET 10**（推荐）或 **.NET 9**；EF Core 与 ASP.NET Core **同主版本** |

---

## 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 运行时 | **.NET 10**（首选）/ .NET 9 | 新项目不锁定 .NET 8；团队可统一 SDK |
| 框架 | ASP.NET Core Web API | `[ApiController]` + `ControllerBase` |
| ORM | **EF Core 10**（或 9）+ `Npgsql.EntityFrameworkCore.PostgreSQL` | Code First + Migrations |
| 校验 | FluentValidation + `FluentValidation.AspNetCore` | 与现有 Zod 规则对齐 |
| 配置 | `appsettings.json` + `appsettings.Development.json` + **User Secrets** | 本地敏感信息不进仓库 |
| 日志 | Serilog（可选）+ 内置 `ILogger` | 开发可用默认日志 |
| API 文档 | **OpenAPI**（`Microsoft.AspNetCore.OpenApi`） | 开发环境 `/openapi/v1.json` |
| 健康检查 | `Microsoft.Extensions.Diagnostics.HealthChecks` + Npgsql | `GET /health` |
| 单元测试 | xUnit + Moq | Service / Validator |
| 集成测试 | xUnit + **WebApplicationFactory** | HTTP 端到端（内存或 Testcontainers） |

**不采用**：YamlDotNet / 独立 YAML 配置（非 ASP.NET 惯例，增加依赖无收益）。

---

## API 形态：Controllers（已定）

| 选项 | 结论 |
|------|------|
| Minimal APIs + `MapGroup` | 更轻量，适合微服务；**本次不选** |
| **Controllers** | **采用** |

**保留 Controllers 的理由**（稳定替换 + 团队熟悉 MVC）：

1. 路由、模型绑定、`[FromBody]` / `[FromQuery]` 与团队现有 .NET 经验一致。  
2. `TodosController` 单文件即可覆盖 5 个端点，复杂度可控。  
3. 集成测试用 `WebApplicationFactory` 对 Controller 管道成熟、示例多。  
4. 后续若加认证、版本化、`[Authorize]`，Controller 生态更直观。  

> 若未来拆成多个资源 API，再评估是否对新模块使用 Minimal APIs；Todo 模块维持 Controller 即可。

---

## 项目结构

```
backend/aspnet/
├── Controllers/
│   ├── TodosController.cs
│   └── HealthController.cs          # 可选：或仅用 MapHealthChecks
├── Models/
│   ├── Entities/
│   │   └── Todo.cs
│   └── Dtos/
│       ├── CreateTodoRequest.cs
│       ├── UpdateTodoRequest.cs
│       └── TodoResponse.cs
├── Data/
│   ├── AppDbContext.cs
│   └── Configurations/
│       └── TodoConfiguration.cs     # IEntityTypeConfiguration（可选）
├── Services/
│   ├── ITodoService.cs
│   └── TodoService.cs
├── Validators/
│   ├── CreateTodoValidator.cs
│   └── UpdateTodoValidator.cs
├── Infrastructure/
│   └── GlobalExceptionHandler.cs    # IExceptionHandler
├── Properties/
│   └── launchSettings.json          # http://localhost:3000（与 Node 相同）
├── Program.cs
├── appsettings.json
├── appsettings.Development.json
└── TodoApi.Tests/
    ├── Unit/                        # Service、Validator
    └── Integration/
        └── TodosApiTests.cs         # WebApplicationFactory
```

---

## 本地端口与 Vite 代理（双后端共用）

| 服务 | URL | 说明 |
|------|-----|------|
| 前端 (Vite) | `http://localhost:5173` | 不变 |
| **API（Node 或 .NET 二选一）** | **`http://localhost:3000`** | 同一端口，同时只能跑一个后端 |

详见 [`docs/dual-backend.md`](dual-backend.md)。

### `Properties/launchSettings.json`

```json
{
  "profiles": {
    "http": {
      "applicationUrl": "http://localhost:3000",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "ASPNETCORE_URLS": "http://localhost:3000"
      }
    }
  }
}
```

### `frontend/vite.config.ts`（无需因切换后端而修改）

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
  },
},
```

---

## API 契约（与现有前端兼容）

| Method | Path | 成功状态码 | 说明 |
|--------|------|------------|------|
| GET | `/health` | 200 | `{ "status": "ok" }`（与 Node 版一致） |
| GET | `/api/todos` | 200 | 列表；query: `filter` / `sort` / `search` |
| GET | `/api/todos/{id}` | 200 / 404 | 单条 |
| POST | `/api/todos` | 201 | 创建 |
| PATCH | `/api/todos/{id}` | 200 / 404 | 部分更新 |
| DELETE | `/api/todos/{id}` | **204** / 404 | **无响应体**；勿返回 JSON body |

### JSON 序列化

- 属性名：**camelCase**（`System.Text.Json` 默认 `PropertyNamingPolicy = JsonNamingPolicy.CamelCase`）。  
- 日期：`createdAt` / `updatedAt` / `dueDate` 为 ISO 8601 字符串（UTC），与前端 `Todo` 类型一致。

### 请求/响应示例

**POST /api/todos**

```json
// Request
{
  "text": "string (必填, max 500)",
  "description": "string? (max 2000)",
  "priority": "low|medium|high",
  "dueDate": "YYYY-MM-DD?"
}

// Response 201
{
  "id": 1,
  "text": "string",
  "description": null,
  "completed": false,
  "priority": "medium",
  "dueDate": null,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

**GET /api/todos?filter=all|active|completed&sort=created|dueDate|priority&search=keyword**

- `filter` 默认 `all`；仅非 `all` 时前端才传参（与 `api.ts` 一致）。  
- `sort` 默认 `created`；仅非 `created` 时前端才传参。  
- `search` 为空时不传。

---

## 错误响应（与前端 `api.ts` 一致）

前端读取：`body.error`（见 `frontend/src/lib/api.ts`）。**统一 JSON 形如** `{ "error": string }`；校验失败可附加 `details`（前端目前仅用 `error` 文案）。

| HTTP | `error` 文案（建议固定） | 场景 |
|------|-------------------------|------|
| 400 | `Validation error` | FluentValidation / 模型无效；可选 `details` |
| 404 | `Todo not found` | 单条不存在；DELETE 目标不存在 |
| 500 | `Internal server error` | 未预期异常 |

实现方式（.NET 8+）：注册 **`IExceptionHandler`**（如 `GlobalExceptionHandler`），在 `Program.cs` 中 `AddExceptionHandler` + `UseExceptionHandler`，避免在 Controller 内散落 try/catch。

```csharp
// 示例：未找到
return NotFound(new { error = "Todo not found" });

// 示例：校验失败
return BadRequest(new { error = "Validation error", details = validationErrors });
```

**DELETE 注意**：返回 `204 No Content` 且**不要**写入 body；与前端「无 body 不设 Content-Type」行为兼容。

---

## 过滤 / 搜索 / 排序（与 Node + Prisma 行为对齐）

行为须与 `backend/nodejs/src/routes/todos.ts` **一致**（Parity Checklist）。

### 过滤 `filter`

| 值 | 条件 |
|----|------|
| `all`（默认） | 无额外条件 |
| `active` | `completed == false` |
| `completed` | `completed == true` |

### 搜索 `search`

- 匹配 `text` 或 `description`（`description` 为 null 时不匹配描述侧）。  
- **大小写不敏感**（对齐 Prisma `mode: 'insensitive'`）：

```csharp
if (!string.IsNullOrWhiteSpace(search))
{
    var pattern = $"%{search}%";
    query = query.Where(t =>
        EF.Functions.ILike(t.Text, pattern) ||
        (t.Description != null && EF.Functions.ILike(t.Description, pattern)));
}
```

### 排序 `sort`

| `sort` | 主排序 | 次排序（与 Node 一致） |
|--------|--------|------------------------|
| `created`（默认） | `createdAt` **DESC** | — |
| `dueDate` | `dueDate` **ASC**（null 视为最晚） | `createdAt` **DESC** |
| `priority` | `priority` **ASC**（字符串序，与现库一致） | `createdAt` **DESC** |

```csharp
query = sort switch
{
    "dueDate" => query
        .OrderBy(t => t.DueDate ?? DateTime.MaxValue)
        .ThenByDescending(t => t.CreatedAt),
    "priority" => query
        .OrderBy(t => t.Priority)
        .ThenByDescending(t => t.CreatedAt),
    _ => query.OrderByDescending(t => t.CreatedAt),
};
```

---

## Entity 模型

```csharp
public class Todo
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool Completed { get; set; }
    public string Priority { get; set; } = "medium";  // low | medium | high
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

索引与现有 Prisma schema 一致：`completed`、`createdAt`、`dueDate`、`priority`。

---

## 配置（appsettings + User Secrets）

### `appsettings.json`

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=todolist;Username=postgres;Password=postgres"
  },
  "Cors": {
    "AllowedOrigins": [ "http://localhost:5173" ]
  },
  "Serilog": {
    "MinimumLevel": "Information"
  }
}
```

### 本地敏感信息（User Secrets）

```bash
cd backend/aspnet
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Default" "Host=localhost;Database=todolist;Username=postgres;Password=<your-password>"
```

`Program.cs` 中：`builder.Configuration.AddUserSecrets<Program>(optional: true)`（Development 环境）。

---

## 关键设计决策

### 1. DbContext

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
```

### 2. CORS

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
```

### 3. OpenAPI（开发环境）

```csharp
builder.Services.AddOpenApi();
// ...
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
```

### 4. Health Check

```csharp
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("Default")!);

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { status = "ok" });
    }
});
```

> 若需严格区分 DB 不可用，可将 `status` 改为 `healthy` / `unhealthy`；前端当前不调用 `/health`，但运维与集成测试会使用。

### 5. 全局异常（`IExceptionHandler`）

- `ValidationException` / FluentValidation → **400** + `{ "error": "Validation error", ... }`  
- 业务未找到 → **404** + `{ "error": "Todo not found" }`  
- 其它 → **500** + `{ "error": "Internal server error" }`（不向客户端暴露堆栈）

---

## 测试策略

### 单元测试（xUnit + Moq）

- `TodoService`：filter / sort / search 组合（可 mock `DbContext` 或使用 InMemory provider 做查询测试）。  
- `CreateTodoValidator` / `UpdateTodoValidator`：边界长度、`priority` 枚举值。

### 集成测试（xUnit + WebApplicationFactory）

至少覆盖：

| 用例 | 断言 |
|------|------|
| **CRUD happy path** | POST 201 → GET 200 → PATCH 200 → DELETE **204** → GET **404** |
| **404** | `GET /api/todos/99999` → 404，`error == "Todo not found"` |
| **DELETE 无 body** | 204，`Content-Length` 为 0 或无 body |

```csharp
public class TodosApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public TodosApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Crud_happy_path()
    {
        var create = await _client.PostAsJsonAsync("/api/todos", new { text = "integration-test" });
        create.EnsureSuccessStatusCode();
        var todo = await create.Content.ReadFromJsonAsync<TodoResponse>();
        Assert.NotNull(todo);

        var get = await _client.GetAsync($"/api/todos/{todo.Id}");
        get.EnsureSuccessStatusCode();

        var patch = await _client.PatchAsJsonAsync($"/api/todos/{todo.Id}", new { completed = true });
        patch.EnsureSuccessStatusCode();

        var delete = await _client.DeleteAsync($"/api/todos/{todo.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var missing = await _client.GetAsync($"/api/todos/{todo.Id}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }
}
```

- 数据库：优先 **Testcontainers PostgreSQL** 或与开发库隔离的 `todolist_test`；CI 无 Docker 时可退化为 **EF Core InMemory**（仅验证 HTTP 契约，搜索 ILike 需单独单元测试）。

---

## 实现步骤

1. `dotnet new webapi -n TodoApi -f net10.0`（或 `net9.0`）  
2. 安装 NuGet：`Npgsql.EntityFrameworkCore.PostgreSQL`、`FluentValidation.AspNetCore`、`Microsoft.AspNetCore.OpenApi`、测试包  
3. Entity + `AppDbContext` + Migrations（对齐现有 `todos` 表）  
4. `ITodoService` / `TodoService`（含 filter / ILike search / 双字段排序）  
5. `TodosController` + FluentValidation  
6. `IExceptionHandler`、CORS、OpenAPI、Health、`launchSettings` **3000**（与 Node 一致）  
7. 确认 `frontend/vite.config.ts` 代理为 **3000**（已配置则无需改前端）  
8. 单元测试 + **集成测试**（CRUD + 404）  
9. 按下方 Parity Checklist 手工验收  

---

## 验收标准

### 功能

- [ ] 所有 CRUD 状态码正确：200 / 201 / 204 / 400 / 404 / 500  
- [ ] `filter` / `sort` / `search` 与 Node 后端结果一致（含大小写不敏感搜索、次要排序）  
- [ ] `DELETE` 返回 **204**，无 body  
- [ ] 404 响应 `{ "error": "Todo not found" }`  
- [ ] 前端经 Vite 代理 `5173 → 3000` 全流程可用；可与 Node 互换启动，前端零改动  

### 运维与质量

- [ ] `GET /health` 返回 `{ "status": "ok" }`  
- [ ] 开发环境 OpenAPI 可访问  
- [ ] 单元测试通过；集成测试至少 **1 条 CRUD happy path + 1 条 404**  
- [ ] 连接字符串来自 User Secrets / 环境变量，仓库内无真实密码  

### Node → ASP.NET Parity Checklist

- [ ] 相同 PostgreSQL 表结构（或 EF 迁移等价）  
- [ ] Query 默认值：`filter=all`、`sort=created`  
- [ ] 搜索：`text` + `description`，**case-insensitive**  
- [ ] 排序：`dueDate` / `priority` 带 `createdAt desc`  tie-breaker  
- [ ] 错误 JSON 字段名：`error`（及可选 `details`）  
- [ ] camelCase + ISO 日期  

---

## 参考

- 现有 Node 实现：`backend/nodejs/src/routes/todos.ts`  
- 前端契约：`frontend/src/lib/api.ts`  
- 总览设计：`docs/technical-design.md`
