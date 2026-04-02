import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetTasksHandler = vi.fn();
const mockCreateTaskHandler = vi.fn();
const mockUpdateTaskHandler = vi.fn();
const mockDeleteTaskHandler = vi.fn();

vi.mock("@/lib/tasks/getTasksHandler", () => ({
  getTasksHandler: (...args: unknown[]) => mockGetTasksHandler(...args),
}));

vi.mock("@/lib/tasks/createTaskHandler", () => ({
  createTaskHandler: (...args: unknown[]) => mockCreateTaskHandler(...args),
}));

vi.mock("@/lib/tasks/updateTaskHandler", () => ({
  updateTaskHandler: (...args: unknown[]) => mockUpdateTaskHandler(...args),
}));

vi.mock("@/lib/tasks/deleteTaskHandler", () => ({
  deleteTaskHandler: (...args: unknown[]) => mockDeleteTaskHandler(...args),
}));

const { GET, POST, PATCH, DELETE, OPTIONS } = await import("../route");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tasks", () => {
  it("delegates to getTasksHandler", async () => {
    const expected = NextResponse.json({ status: "success", tasks: [] }, { status: 200 });
    mockGetTasksHandler.mockResolvedValue(expected);

    const request = new NextRequest("https://example.com/api/tasks");
    const response = await GET(request);

    expect(mockGetTasksHandler).toHaveBeenCalledWith(request);
    expect(response).toBe(expected);
  });
});

describe("POST /api/tasks", () => {
  it("delegates to createTaskHandler", async () => {
    const expected = NextResponse.json({ status: "success", tasks: [] }, { status: 200 });
    mockCreateTaskHandler.mockResolvedValue(expected);

    const request = new NextRequest("https://example.com/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "t", prompt: "p", schedule: "0 0 * * *", account_id: "a", artist_account_id: "ar" }),
    });
    const response = await POST(request);

    expect(mockCreateTaskHandler).toHaveBeenCalledWith(request);
    expect(response).toBe(expected);
  });

  it("returns 401 when handler rejects unauthenticated request", async () => {
    mockCreateTaskHandler.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("https://example.com/api/tasks", {
      method: "POST",
      body: "{}",
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/tasks", () => {
  it("delegates to updateTaskHandler", async () => {
    const expected = NextResponse.json({ status: "success", tasks: [] }, { status: 200 });
    mockUpdateTaskHandler.mockResolvedValue(expected);

    const request = new NextRequest("https://example.com/api/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id: "task-1", title: "x" }),
    });
    const response = await PATCH(request);

    expect(mockUpdateTaskHandler).toHaveBeenCalledWith(request);
    expect(response).toBe(expected);
  });

  it("returns 401 when handler rejects unauthenticated request", async () => {
    mockUpdateTaskHandler.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("https://example.com/api/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id: "task-1" }),
    });
    const response = await PATCH(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when handler rejects cross-account access", async () => {
    mockUpdateTaskHandler.mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403 },
      ),
    );

    const request = new NextRequest("https://example.com/api/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id: "task-1" }),
    });
    const response = await PATCH(request);

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/tasks", () => {
  it("delegates to deleteTaskHandler", async () => {
    const expected = NextResponse.json({ status: "success" }, { status: 200 });
    mockDeleteTaskHandler.mockResolvedValue(expected);

    const request = new NextRequest("https://example.com/api/tasks", {
      method: "DELETE",
      body: JSON.stringify({ id: "task-1" }),
    });
    const response = await DELETE(request);

    expect(mockDeleteTaskHandler).toHaveBeenCalledWith(request);
    expect(response).toBe(expected);
  });

  it("returns 401 when handler rejects unauthenticated request", async () => {
    mockDeleteTaskHandler.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("https://example.com/api/tasks", {
      method: "DELETE",
      body: JSON.stringify({ id: "task-1" }),
    });
    const response = await DELETE(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when handler rejects cross-account access", async () => {
    mockDeleteTaskHandler.mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403 },
      ),
    );

    const request = new NextRequest("https://example.com/api/tasks", {
      method: "DELETE",
      body: JSON.stringify({ id: "task-1" }),
    });
    const response = await DELETE(request);

    expect(response.status).toBe(403);
  });
});

describe("OPTIONS /api/tasks", () => {
  it("returns 200 for CORS preflight", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(200);
  });
});
