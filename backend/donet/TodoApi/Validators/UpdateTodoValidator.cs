using FluentValidation;
using TodoApi.Models.Dtos;

namespace TodoApi.Validators;

public class UpdateTodoValidator : AbstractValidator<UpdateTodoRequest>
{
    public UpdateTodoValidator()
    {
        RuleFor(x => x.Text)
            .MaximumLength(500).WithMessage("Text must not exceed 500 characters")
            .When(x => x.Text != null);

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithMessage("Description must not exceed 2000 characters")
            .When(x => x.Description != null);

        RuleFor(x => x.Priority)
            .Must(p => new[] { "low", "medium", "high" }.Contains(p))
            .When(x => x.Priority != null)
            .WithMessage("Priority must be low, medium, or high");

        RuleFor(x => x.DueDate)
            .Matches(@"^\d{4}-\d{2}-\d{2}$")
            .When(x => !string.IsNullOrEmpty(x.DueDate))
            .WithMessage("DueDate must be in YYYY-MM-DD format");
    }
}