using Microsoft.EntityFrameworkCore;
using TodoApi.Models.Entities;

namespace TodoApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Todo> Todos => Set<Todo>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Todo>(entity =>
        {
            entity.ToTable("Todo");
            entity.UsePropertyAccessMode(PropertyAccessMode.Field);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Text).HasColumnName("text");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Completed).HasColumnName("completed");
            entity.Property(e => e.Priority).HasColumnName("priority");
            entity.Property(e => e.DueDate).HasColumnName("due_date");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.Completed).HasDatabaseName("ix_todos_completed");
            entity.HasIndex(e => e.CreatedAt).HasDatabaseName("ix_todos_createdat");
            entity.HasIndex(e => e.DueDate).HasDatabaseName("ix_todos_duedate");
            entity.HasIndex(e => e.Priority).HasDatabaseName("ix_todos_priority");

            entity.Property(e => e.Priority).HasDefaultValue("medium");
            entity.Property(e => e.Completed).HasDefaultValue(false);
        });
    }
}