using Microsoft.AspNetCore.Mvc;
using TodoApi.Models.Dtos;
using TodoApi.Services;
using TodoApi.Validators;
using FluentValidation;

namespace TodoApi.Controllers;

[ApiController]
[Route("api/todos")]
public class TodosController : ControllerBase
{
    private readonly ITodoService _todoService;

    public TodosController(ITodoService todoService)
    {
        _todoService = todoService;
    }

    [HttpGet]
    public async Task<IActionResult> GetTodos(
        [FromQuery] string? filter,
        [FromQuery] string? sort,
        [FromQuery] string? search)
    {
        var todos = await _todoService.GetTodosAsync(filter, sort, search);
        return Ok(todos);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var todo = await _todoService.GetByIdAsync(id);
        if (todo == null)
            return NotFound(new { error = "Todo not found" });
        return Ok(todo);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTodoRequest request)
    {
        var validator = new CreateTodoValidator();
        var result = validator.Validate(request);
        if (!result.IsValid)
            return BadRequest(new { error = "Validation error" });

        var todo = await _todoService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = todo.Id }, todo);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTodoRequest request)
    {
        var validator = new UpdateTodoValidator();
        var result = validator.Validate(request);
        if (!result.IsValid)
            return BadRequest(new { error = "Validation error" });

        var todo = await _todoService.UpdateAsync(id, request);
        if (todo == null)
            return NotFound(new { error = "Todo not found" });
        return Ok(todo);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _todoService.DeleteAsync(id);
        if (!deleted)
            return NotFound(new { error = "Todo not found" });
        return NoContent();
    }
}