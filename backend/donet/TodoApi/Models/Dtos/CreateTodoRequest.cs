using System.Text.Json.Serialization;

namespace TodoApi.Models.Dtos;

public class CreateTodoRequest
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("priority")]
    public string Priority { get; set; } = "medium";

    [JsonPropertyName("dueDate")]
    public string? DueDate { get; set; }
}