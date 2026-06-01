from typing import Literal
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.todo import CreateTodoRequest, UpdateTodoRequest, TodoResponse
from app.services.todo_service import TodoService
from app.core.exceptions import NotFoundError

router = APIRouter()


@router.get("", response_model=list[TodoResponse])
async def get_todos(
    filter: Literal["all", "active", "completed"] = Query(default="all"),
    sort: Literal["created", "dueDate", "priority"] = Query(default="created"),
    search: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    service = TodoService(db)
    return await service.get_todos(filter, sort, search)


@router.get("/{id}", response_model=TodoResponse)
async def get_todo(id: int, db: AsyncSession = Depends(get_db)):
    service = TodoService(db)
    todo = await service.get_by_id(id)
    if not todo:
        raise NotFoundError()
    return todo


@router.post("", status_code=201, response_model=TodoResponse)
async def create_todo(data: CreateTodoRequest, db: AsyncSession = Depends(get_db)):
    service = TodoService(db)
    return await service.create(data)


@router.patch("/{id}", response_model=TodoResponse)
async def update_todo(id: int, data: UpdateTodoRequest, db: AsyncSession = Depends(get_db)):
    service = TodoService(db)
    todo = await service.update(id, data)
    if not todo:
        raise NotFoundError()
    return todo


@router.delete("/{id}", status_code=204)
async def delete_todo(id: int, db: AsyncSession = Depends(get_db)):
    service = TodoService(db)
    deleted = await service.delete(id)
    if not deleted:
        raise NotFoundError()
    return Response(status_code=204)