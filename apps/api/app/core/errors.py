from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict[str, Any] | None = None):
        self.status, self.code, self.message, self.details = status, code, message, details


def not_found(entity: str) -> AppError:
    return AppError(404, "not_found", f"{entity} not found")


def forbidden() -> AppError:
    return AppError(403, "forbidden", "Not allowed")


def conflict(code: str, message: str) -> AppError:
    return AppError(409, code, message)


async def app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    body = ErrorResponse(code=exc.code, message=exc.message, details=exc.details)
    return JSONResponse(status_code=exc.status, content=body.model_dump(exclude_none=True))


ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {"model": ErrorResponse} for status in (400, 401, 403, 404, 409, 503)
}
