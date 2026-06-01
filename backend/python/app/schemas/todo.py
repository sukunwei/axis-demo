from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class TodoBase(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        ser_json_by_alias=True,
    )


class CreateTodoRequest(TodoBase):
    text: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    priority: Literal["low", "medium", "high"] = "medium"
    due_date: str | None = Field(default=None, alias="dueDate")


class UpdateTodoRequest(TodoBase):
    text: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    completed: bool | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: str | None = Field(default=None, alias="dueDate")


class TodoResponse(TodoBase):
    id: int
    text: str
    description: str | None
    completed: bool
    priority: str
    due_date: str | None = Field(alias="dueDate")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class ErrorResponse(BaseModel):
    error: str