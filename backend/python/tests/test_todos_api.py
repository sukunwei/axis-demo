import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_crud_happy_path(client: AsyncClient):
    """Test full CRUD lifecycle"""
    # POST
    r = await client.post("/api/todos", json={"text": "pytest test"})
    assert r.status_code == 201
    todo_id = r.json()["id"]
    assert r.json()["text"] == "pytest test"
    assert r.json()["completed"] is False

    # GET single
    r = await client.get(f"/api/todos/{todo_id}")
    assert r.status_code == 200
    assert r.json()["text"] == "pytest test"

    # PATCH update
    r = await client.patch(f"/api/todos/{todo_id}", json={"completed": True, "priority": "high"})
    assert r.status_code == 200
    assert r.json()["completed"] is True
    assert r.json()["priority"] == "high"

    # DELETE
    r = await client.delete(f"/api/todos/{todo_id}")
    assert r.status_code == 204

    # GET 404
    r = await client.get(f"/api/todos/{todo_id}")
    assert r.status_code == 404
    assert r.json()["error"] == "Todo not found"


@pytest.mark.asyncio
async def test_create_with_due_date(client: AsyncClient):
    """Test creating todo with due date"""
    r = await client.post("/api/todos", json={
        "text": "deadline task",
        "dueDate": "2026-06-15"
    })
    assert r.status_code == 201
    assert "2026-06-15" in r.json()["dueDate"]


@pytest.mark.asyncio
async def test_create_validation_error(client: AsyncClient):
    """Test validation error for empty text"""
    r = await client.post("/api/todos", json={"text": ""})
    assert r.status_code == 400
    assert r.json()["error"] == "Validation error"


@pytest.mark.asyncio
async def test_not_found(client: AsyncClient):
    """Test 404 for non-existent todo"""
    r = await client.get("/api/todos/99999")
    assert r.status_code == 404
    assert r.json()["error"] == "Todo not found"


@pytest.mark.asyncio
async def test_delete_not_found(client: AsyncClient):
    """Test 404 when deleting non-existent todo"""
    r = await client.delete("/api/todos/99999")
    assert r.status_code == 404
    assert r.json()["error"] == "Todo not found"


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    """Test health endpoint"""
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}