using TodoApi.Models.Dtos;

namespace TodoApi.Services;

public interface ITodoService
{
    Task<IEnumerable<TodoResponse>> GetTodosAsync(string? filter, string? sort, string? search);
    Task<TodoResponse?> GetByIdAsync(int id);
    Task<TodoResponse> CreateAsync(CreateTodoRequest request);
    Task<TodoResponse?> UpdateAsync(int id, UpdateTodoRequest request);
    Task<bool> DeleteAsync(int id);
}