using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TodoApi.Data;
using TodoApi.Services;
using TodoApi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Add DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// Add Services
builder.Services.AddScoped<ITodoService, TodoService>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Add Controllers
builder.Services.AddControllers();

// Add OpenAPI
builder.Services.AddOpenApi();

// Add Exception Handler
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

var app = builder.Build();

// Configure Kestrel to use port 5555
app.Urls.Clear();
app.Urls.Add("http://localhost:5555");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.UseCors("AllowFrontend");
app.Use(async (context, next) =>
{
    context.Response.Headers.Server = "donet";
    await next();
});
app.UseExceptionHandler(_ => { });
app.MapControllers();

app.Run();