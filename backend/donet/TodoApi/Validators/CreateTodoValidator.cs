using FluentValidation;
using TodoApi.Models.Dtos;

namespace TodoApi.Validators;

public class CreateTodoValidator : AbstractValidator<CreateTodoRequest>
{
    public CreateTodoValidator()
    {
        RuleFor(x => x.Text)
            .NotEmpty().WithMessage("Text is required")
            .MaximumLength(500).WithMessage("Text must not exceed 500 characters");

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithMessage("Description must not exceed 2000 characters");

        RuleFor(x => x.Priority)
            .Must(p => new[] { "low", "medium", "high" }.Contains(p))
            .When(x => !string.IsNullOrEmpty(x.Priority))
            .WithMessage("Priority must be low, medium, or high");

        RuleFor(x => x.DueDate)
            .Matches(@"^\d{4}-\d{2}-\d{2}$")
            .When(x => !string.IsNullOrEmpty(x.DueDate))
            .WithMessage("DueDate must be in YYYY-MM-DD format");
    }
}