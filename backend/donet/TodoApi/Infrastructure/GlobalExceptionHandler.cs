using Microsoft.AspNetCore.Diagnostics;
using System.Net;
using System.Text.Json;
using FluentValidation;

namespace TodoApi.Infrastructure;

public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken = default)
    {
        _logger.LogError(exception, "An unhandled exception occurred");

        var (statusCode, errorMessage) = exception switch
        {
            ValidationException validationEx =>
                (HttpStatusCode.BadRequest, "Validation error"),
            KeyNotFoundException =>
                (HttpStatusCode.NotFound, "Todo not found"),
            ArgumentException argEx =>
                (HttpStatusCode.BadRequest, argEx.Message),
            _ =>
                (HttpStatusCode.InternalServerError, "Internal server error")
        };

        httpContext.Response.StatusCode = (int)statusCode;
        httpContext.Response.ContentType = "application/json";

        var response = JsonSerializer.Serialize(new { error = errorMessage });
        await httpContext.Response.WriteAsync(response, cancellationToken);

        return true;
    }
}