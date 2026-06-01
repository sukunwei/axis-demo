# ASP.NET Core Web API 開發計劃

> 基於 `docs/asp.net-web-technical-design.md`，按實施順序排列。

---

## 階段一：項目初始化（第 1-2 天）

### 1.1 建立專案

```bash
cd backend
dotnet new webapi -n TodoApi -f net10.0 --no-https
cd TodoApi
```

### 1.2 安裝 NuGet Packages

```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package FluentValidation.AspNetCore
dotnet add package Microsoft.AspNetCore.OpenApi
dotnet add package Microsoft.Extensions.Diagnostics.HealthChecks.NpgSql

# 測試
dotnet add package xunit
dotnet add package xunit.runner.visualstudio
dotnet add package Moq
dotnet add package Microsoft.AspNetCore.Mvc.Testing
```

### 1.3 設定 launchSettings.json

確保 `applicationUrl` 為 `http://localhost:3000`（與 Node 後端相同，見 `docs/dual-backend.md`）

---

## 階段二：Entity + DbContext（第 2-3 天）

### 2.1 建立 Todo Entity

```csharp
// Models/Entities/Todo.cs
public class Todo
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool Completed { get; set; }
    public string Priority { get; set; } = "medium";
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

### 2.2 建立 AppDbContext

```csharp
// Data/AppDbContext.cs
public class AppDbContext : DbContext
{
    public DbSet<Todo> Todos => Set<Todo>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Todo>(entity =>
        {
            entity.HasIndex(e => e.Completed);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.DueDate);
            entity.HasIndex(e => e.Priority);
        });
    }
}
```

### 2.3 連接現有 PostgreSQL（不新建表）

```bash
# 驗證現有資料庫結構與 EF Entity 對齊
dotnet ef dbcontext scaffold \
  "Host=localhost;Database=todolist;Username=postgres;Password=postgres" \
  Npgsql.EntityFrameworkCore.PostgreSQL \
  --output-dir Models/Entities
```

---

## 階段三：DTOs + Validators（第 3 天）

### 3.1 DTOs

- `CreateTodoRequest.cs` — text (必填, max 500), description (max 2000), priority, dueDate
- `UpdateTodoRequest.cs` — 全部可選
- `TodoResponse.cs` — id, text, description, completed, priority, dueDate, createdAt, updatedAt

### 3.2 FluentValidation

```csharp
// CreateTodoValidator
RuleFor(x => x.Text).NotEmpty().MaximumLength(500);
RuleFor(x => x.Description).MaximumLength(2000);
RuleFor(x => x.Priority).Must(p => new[] { "low", "medium", "high" }.Contains(p));

// UpdateTodoValidator
RuleFor(x => x.Text).MaximumLength(500).When(x => x.Text != null);
```

---

## 階段四：Service 層（第 3-4 天）

### 4.1 ITodoService

```csharp
Task<IEnumerable<Todo>> GetTodosAsync(string? filter, string? sort, string? search);
Task<Todo?> GetByIdAsync(int id);
Task<Todo> CreateAsync(CreateTodoRequest request);
Task<Todo?> UpdateAsync(int id, UpdateTodoRequest request);
Task<bool> DeleteAsync(int id);
```

### 4.2 實現過濾/搜索/排序邏輯

| 功能 | 實現 |
|------|------|
| filter=active | `Where(t => !t.Completed)` |
| filter=completed | `Where(t => t.Completed)` |
| search | `EF.Functions.ILike` 匹配 text + description |
| sort=dueDate | `OrderBy(t => t.DueDate ?? DateTime.MaxValue).ThenByDescending(t => t.CreatedAt)` |
| sort=priority | `OrderBy(t => t.Priority).ThenByDescending(t => t.CreatedAt)` |

---

## 階段五：Controller（第 4-5 天）

### 5.1 TodosController

```
GET    /health                          → 200 { "status": "ok" }
GET    /api/todos?filter&sort&search    → 200 [Todo]
GET    /api/todos/{id}                  → 200 Todo / 404
POST   /api/todos                       → 201 Todo
PATCH  /api/todos/{id}                  → 200 Todo / 404
DELETE /api/todos/{id}                  → 204 / 404
```

### 5.2 全域異常處理（IExceptionHandler）

- ValidationException → 400
- 找不到 → 404
- 其他 → 500

---

## 階段六：配置與中間件（第 5 天）

### 6.1 Program.cs

```csharp
// DbContext
builder.Services.AddDbContext<AppDbContext>();

// CORS
builder.Services.AddCors(options =>
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:5173").AllowAnyMethod().AllowAnyHeader()));

// Validators
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Health Check
builder.Services.AddHealthChecks().AddNpgSql(connectionString);

// Exception Handler
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
```

### 6.2 appsettings.json

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=todolist;Username=postgres;Password=postgres"
  },
  "Cors": {
    "AllowedOrigins": ["http://localhost:5173"]
  }
}
```

---

## 階段七：單元測試（第 6-7 天）

### 7.1 TodoService 測試

- 測試 filter: all / active / completed
- 測試 sort: created / dueDate / priority（含次排序）
- 測試 search: 匹配 text、匹配 description、大小寫不敏感

### 7.2 Validator 測試

- text 為空 / 超長
- priority 無效值
- dueDate 格式

### 7.3 集成測試（WebApplicationFactory）

```csharp
[Fact]
public async Task Crud_happy_path()
{
    var create = await _client.PostAsJsonAsync("/api/todos", new { text = "test" });
    Assert.Equal(HttpStatusCode.Created, create.StatusCode);

    var todo = await create.Content.ReadFromJsonAsync<TodoResponse>();
    var get = await _client.GetAsync($"/api/todos/{todo!.Id}");
    Assert.Equal(HttpStatusCode.OK, get.StatusCode);

    var delete = await _client.DeleteAsync($"/api/todos/{todo.Id}");
    Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

    var missing = await _client.GetAsync($"/api/todos/{todo.Id}");
    Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
}
```

---

## 階段八：前端適配（第 7 天）

### 8.1 更新 Vite Proxy

```typescript
// frontend/vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
  },
},
```

### 8.2 停止 Node 後端

```bash
# 停止 3000 端口
pkill -f "tsx watch"
# 或停止 3000 端口進程
lsof -ti:3000 | xargs kill
```

---

## 驗收清單

| # | 項目 | 標準 |
|---|------|------|
| 1 | GET /health | `200 { "status": "ok" }` |
| 2 | POST /api/todos | `201` + created todo（含正確日期格式） |
| 3 | GET /api/todos?filter=active | 只返回未完成 |
| 4 | GET /api/todos?sort=priority | priority ASC + createdAt DESC |
| 5 | GET /api/todos?search=buy | text/description 大小寫不敏感匹配 |
| 6 | PATCH /api/todos/{id} | `200` + 更新後資料 |
| 7 | DELETE /api/todos/{id} | `204` No Content，無 body |
| 8 | GET /api/todos/99999 | `404 { "error": "Todo not found" }` |
| 9 | DELETE /api/todos/99999 | `404 { "error": "Todo not found" }` |
| 10 | 前端新增任務 | 立即顯示在列表，無需刷新 |
| 11 | 前端刪除任務 | 立即從列表消失，無需刷新 |
| 12 | 所有單元測試 | `dotnet test` 通過 |
| 13 | 集成測試 | CRUD happy path + 404 通過 |

---

## 預估時間線

| 階段 | 內容 | 預估 |
|------|------|------|
| 一 | 項目初始化 | 0.5 天 |
| 二 | Entity + DbContext | 0.5 天 |
| 三 | DTOs + Validators | 0.5 天 |
| 四 | Service 層 | 1 天 |
| 五 | Controller | 1 天 |
| 六 | 配置與中間件 | 0.5 天 |
| 七 | 測試 | 1.5 天 |
| 八 | 前端適配 + 驗收 | 0.5 天 |
| **合計** | | **6 天** |

---

## 快速啟動腳本

```bash
# 1. 建立專案
cd backend
dotnet new webapi -n TodoApi -f net10.0 --no-https

# 2. 安裝packages
cd TodoApi
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package FluentValidation.AspNetCore
dotnet add package Microsoft.AspNetCore.OpenApi
dotnet add package Microsoft.Extensions.Diagnostics.HealthChecks.NpgSql

# 3. 啟動開發伺服器
dotnet watch run
# 访问 http://localhost:3000/openapi/v1.json（开发环境 OpenAPI）
```