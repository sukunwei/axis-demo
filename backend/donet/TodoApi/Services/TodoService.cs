using Microsoft.EntityFrameworkCore;
using Npgsql;
using TodoApi.Data;
using TodoApi.Models.Dtos;
using TodoApi.Models.Entities;

namespace TodoApi.Services;

public class TodoService : ITodoService
{
    private readonly AppDbContext _context;

    public TodoService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<TodoResponse>> GetTodosAsync(string? filter, string? sort, string? search)
    {
        var connection = _context.Database.GetDbConnection();
        await connection.OpenAsync();
        var npgsqlConn = (NpgsqlConnection)connection;

        var conditions = new List<string>();
        if (filter == "active")
            conditions.Add("completed = false");
        else if (filter == "completed")
            conditions.Add("completed = true");

        if (!string.IsNullOrWhiteSpace(search))
            conditions.Add("(text ILIKE @search OR description ILIKE @search)");

        var whereClause = conditions.Count > 0 ? " WHERE " + string.Join(" AND ", conditions) : "";

        var orderBy = sort?.ToLower() switch
        {
            "duedate" => "ORDER BY \"dueDate\" NULLS LAST, \"createdAt\" DESC",
            "priority" => "ORDER BY priority, \"createdAt\" DESC",
            _ => "ORDER BY \"createdAt\" DESC"
        };

        var sql = $@"SELECT id, text, description, completed, priority, ""dueDate"", ""createdAt"", ""updatedAt"" FROM ""Todo""{whereClause} {orderBy}";

        await using var cmd = new NpgsqlCommand(sql, npgsqlConn);
        if (!string.IsNullOrWhiteSpace(search))
            cmd.Parameters.AddWithValue("search", $"%{search}%");

        await using var reader = await cmd.ExecuteReaderAsync();
        var todos = new List<TodoResponse>();
        while (await reader.ReadAsync())
        {
            todos.Add(new TodoResponse
            {
                Id = reader.GetInt32(0),
                Text = reader.GetString(1),
                Description = reader.IsDBNull(2) ? null : reader.GetString(2),
                Completed = reader.GetBoolean(3),
                Priority = reader.GetString(4),
                DueDate = reader.IsDBNull(5) ? null : reader.GetDateTime(5).ToString("yyyy-MM-ddTHH:mm:ssZ"),
                CreatedAt = reader.GetDateTime(6).ToString("yyyy-MM-ddTHH:mm:ssZ"),
                UpdatedAt = reader.GetDateTime(7).ToString("yyyy-MM-ddTHH:mm:ssZ")
            });
        }
        return todos;
    }

    public async Task<TodoResponse?> GetByIdAsync(int id)
    {
        var connection = _context.Database.GetDbConnection();
        await connection.OpenAsync();
        var npgsqlConn = (NpgsqlConnection)connection;

        var sql = @"SELECT id, text, description, completed, priority, ""dueDate"", ""createdAt"", ""updatedAt"" FROM ""Todo"" WHERE id = @id";
        await using var cmd = new NpgsqlCommand(sql, npgsqlConn);
        cmd.Parameters.AddWithValue("id", id);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;

        return new TodoResponse
        {
            Id = reader.GetInt32(0),
            Text = reader.GetString(1),
            Description = reader.IsDBNull(2) ? null : reader.GetString(2),
            Completed = reader.GetBoolean(3),
            Priority = reader.GetString(4),
            DueDate = reader.IsDBNull(5) ? null : reader.GetDateTime(5).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            CreatedAt = reader.GetDateTime(6).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            UpdatedAt = reader.GetDateTime(7).ToString("yyyy-MM-ddTHH:mm:ssZ")
        };
    }

    public async Task<TodoResponse> CreateAsync(CreateTodoRequest request)
    {
        var connection = _context.Database.GetDbConnection();
        await connection.OpenAsync();
        var npgsqlConn = (NpgsqlConnection)connection;

        var now = DateTime.UtcNow;
        var dueDate = string.IsNullOrEmpty(request.DueDate) ? (DateTime?)null : DateTime.Parse(request.DueDate);

        var sql = @"INSERT INTO ""Todo"" (text, description, completed, priority, ""dueDate"", ""createdAt"", ""updatedAt"")
                    VALUES (@text, @description, false, @priority, @dueDate, @createdAt, @updatedAt)
                    RETURNING id, text, description, completed, priority, ""dueDate"", ""createdAt"", ""updatedAt""";

        await using var cmd = new NpgsqlCommand(sql, npgsqlConn);
        cmd.Parameters.AddWithValue("text", request.Text);
        cmd.Parameters.AddWithValue("description", (object?)request.Description ?? DBNull.Value);
        cmd.Parameters.AddWithValue("priority", request.Priority ?? "medium");
        cmd.Parameters.AddWithValue("dueDate", (object?)dueDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("createdAt", now);
        cmd.Parameters.AddWithValue("updatedAt", now);

        await using var reader = await cmd.ExecuteReaderAsync();
        await reader.ReadAsync();

        return new TodoResponse
        {
            Id = reader.GetInt32(0),
            Text = reader.GetString(1),
            Description = reader.IsDBNull(2) ? null : reader.GetString(2),
            Completed = reader.GetBoolean(3),
            Priority = reader.GetString(4),
            DueDate = reader.IsDBNull(5) ? null : reader.GetDateTime(5).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            CreatedAt = reader.GetDateTime(6).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            UpdatedAt = reader.GetDateTime(7).ToString("yyyy-MM-ddTHH:mm:ssZ")
        };
    }

    public async Task<TodoResponse?> UpdateAsync(int id, UpdateTodoRequest request)
    {
        var connection = _context.Database.GetDbConnection();
        await connection.OpenAsync();
        var npgsqlConn = (NpgsqlConnection)connection;

        // First get existing
        var getSql = @"SELECT id, text, description, completed, priority, ""dueDate"", ""createdAt"", ""updatedAt"" FROM ""Todo"" WHERE id = @id";
        await using var getCmd = new NpgsqlCommand(getSql, npgsqlConn);
        getCmd.Parameters.AddWithValue("id", id);

        await using var getReader = await getCmd.ExecuteReaderAsync();
        if (!await getReader.ReadAsync()) return null;

        var text = getReader.GetString(1);
        var description = getReader.IsDBNull(2) ? null : getReader.GetString(2);
        var completed = getReader.GetBoolean(3);
        var priority = getReader.GetString(4);
        var dueDate = getReader.IsDBNull(5) ? (DateTime?)null : getReader.GetDateTime(5);
        var createdAt = getReader.GetDateTime(6);
        getReader.Close();

        if (request.Text != null) text = request.Text;
        if (request.Description != null) description = request.Description;
        if (request.Completed.HasValue) completed = request.Completed.Value;
        if (request.Priority != null) priority = request.Priority;
        if (request.DueDate != null)
            dueDate = string.IsNullOrEmpty(request.DueDate) ? null : DateTime.Parse(request.DueDate);

        var updatedAt = DateTime.UtcNow;

        var updateSql = @"UPDATE ""Todo"" SET text=@text, description=@description, completed=@completed,
                          priority=@priority, ""dueDate""=@dueDate, ""updatedAt""=@updatedAt
                          WHERE id=@id
                          RETURNING id, text, description, completed, priority, ""dueDate"", ""createdAt"", ""updatedAt""";

        await using var updateCmd = new NpgsqlCommand(updateSql, npgsqlConn);
        updateCmd.Parameters.AddWithValue("id", id);
        updateCmd.Parameters.AddWithValue("text", text);
        updateCmd.Parameters.AddWithValue("description", (object?)description ?? DBNull.Value);
        updateCmd.Parameters.AddWithValue("completed", completed);
        updateCmd.Parameters.AddWithValue("priority", priority);
        updateCmd.Parameters.AddWithValue("dueDate", (object?)dueDate ?? DBNull.Value);
        updateCmd.Parameters.AddWithValue("updatedAt", updatedAt);

        await using var updateReader = await updateCmd.ExecuteReaderAsync();
        await updateReader.ReadAsync();

        return new TodoResponse
        {
            Id = updateReader.GetInt32(0),
            Text = updateReader.GetString(1),
            Description = updateReader.IsDBNull(2) ? null : updateReader.GetString(2),
            Completed = updateReader.GetBoolean(3),
            Priority = updateReader.GetString(4),
            DueDate = updateReader.IsDBNull(5) ? null : updateReader.GetDateTime(5).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            CreatedAt = updateReader.GetDateTime(6).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            UpdatedAt = updateReader.GetDateTime(7).ToString("yyyy-MM-ddTHH:mm:ssZ")
        };
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var connection = _context.Database.GetDbConnection();
        await connection.OpenAsync();
        var npgsqlConn = (NpgsqlConnection)connection;

        var sql = @"DELETE FROM ""Todo"" WHERE id = @id";
        await using var cmd = new NpgsqlCommand(sql, npgsqlConn);
        cmd.Parameters.AddWithValue("id", id);

        var rows = await cmd.ExecuteNonQueryAsync();
        return rows > 0;
    }
}