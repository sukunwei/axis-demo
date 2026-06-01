using System.Text.Json.Serialization;

namespace TodoApi.Models.Dtos;

public class UpdateTodoRequest
{
    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("completed")]
    public bool? Completed { get; set; }

    [JsonPropertyName("priority")]
    public string? Priority { get; set; }

    [JsonPropertyName("dueDate")]
    public string? DueDate { get; set; }
}