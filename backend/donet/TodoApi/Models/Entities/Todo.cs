using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TodoApi.Models.Entities;

public class Todo
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(500)]
    [Column("text")]
    public string Text { get; set; } = string.Empty;

    [MaxLength(2000)]
    [Column("description")]
    public string? Description { get; set; }

    [Column("completed")]
    public bool Completed { get; set; }

    [MaxLength(20)]
    [Column("priority")]
    public string Priority { get; set; } = "medium";

    [Column("dueDate")]
    public DateTime? DueDate { get; set; }

    [Column("createdAt")]
    public DateTime CreatedAt { get; set; }

    [Column("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}