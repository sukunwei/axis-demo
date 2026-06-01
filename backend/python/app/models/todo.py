from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class Todo(Base):
    __tablename__ = "Todo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column("text", String(500))
    description: Mapped[str | None] = mapped_column("description", String(2000), nullable=True)
    completed: Mapped[bool] = mapped_column("completed", Boolean, default=False)
    priority: Mapped[str] = mapped_column("priority", String, default="medium")
    due_date: Mapped[date | None] = mapped_column("dueDate", Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )