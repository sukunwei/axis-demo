from datetime import datetime
from sqlalchemy import or_, select, nulls_last
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.todo import Todo
from app.schemas.todo import CreateTodoRequest, UpdateTodoRequest, TodoResponse


class TodoService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _todo_to_response(self, todo: Todo) -> TodoResponse:
        return TodoResponse(
            id=todo.id,
            text=todo.text,
            description=todo.description,
            completed=todo.completed,
            priority=todo.priority,
            due_date=todo.due_date.strftime("%Y-%m-%dT%H:%M:%SZ") if todo.due_date else None,
            created_at=todo.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            updated_at=todo.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )

    async def get_todos(self, filter_str: str, sort: str, search: str) -> list[TodoResponse]:
        stmt = select(Todo)

        if filter_str == "active":
            stmt = stmt.where(Todo.completed.is_(False))
        elif filter_str == "completed":
            stmt = stmt.where(Todo.completed.is_(True))

        if search.strip():
            pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Todo.text.ilike(pattern),
                    Todo.description.isnot(None) & Todo.description.ilike(pattern),
                )
            )

        if sort == "dueDate":
            stmt = stmt.order_by(nulls_last(Todo.due_date.asc()), Todo.created_at.desc())
        elif sort == "priority":
            stmt = stmt.order_by(Todo.priority.asc(), Todo.created_at.desc())
        else:
            stmt = stmt.order_by(Todo.created_at.desc())

        result = await self.db.execute(stmt)
        todos = result.scalars().all()
        return [self._todo_to_response(t) for t in todos]

    async def get_by_id(self, id: int) -> TodoResponse | None:
        todo = await self.db.get(Todo, id)
        if not todo:
            return None
        return self._todo_to_response(todo)

    async def create(self, data: CreateTodoRequest) -> TodoResponse:
        due_date = None
        if data.due_date:
            due_date = datetime.strptime(data.due_date, "%Y-%m-%d").date()

        now = datetime.utcnow()
        todo = Todo(
            text=data.text,
            description=data.description,
            priority=data.priority or "medium",
            due_date=due_date,
            created_at=now,
            updated_at=now,
        )
        self.db.add(todo)
        await self.db.commit()
        await self.db.refresh(todo)
        return self._todo_to_response(todo)

    async def update(self, id: int, data: UpdateTodoRequest) -> TodoResponse | None:
        todo = await self.db.get(Todo, id)
        if not todo:
            return None

        if data.text is not None:
            todo.text = data.text
        if data.description is not None:
            todo.description = data.description
        if data.completed is not None:
            todo.completed = data.completed
        if data.priority is not None:
            todo.priority = data.priority
        if data.due_date is not None:
            todo.due_date = datetime.strptime(data.due_date, "%Y-%m-%d").date() if data.due_date else None

        await self.db.commit()
        await self.db.refresh(todo)
        return self._todo_to_response(todo)

    async def delete(self, id: int) -> bool:
        todo = await self.db.get(Todo, id)
        if not todo:
            return False
        await self.db.delete(todo)
        await self.db.commit()
        return True