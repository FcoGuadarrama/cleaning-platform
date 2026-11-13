import contextlib
import logging
import os
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app import jobs
from app.core.config import get_settings
from app.core.errors import AppError, app_error_handler
from app.routers import addresses, admin, auth, bookings, catalog, notifications, staff_self, subscriptions


def _operation_id(route: APIRoute) -> str:
    return route.name


@contextlib.asynccontextmanager
async def _lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Background jobs (hold sweep, outbox dispatch, housekeeping, renewals, reminders) run next to the API.
    Their INFO logs (and the log push provider) need a handler: uvicorn only configures its own loggers."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s %(message)s")
    tasks = jobs.start(get_settings())
    yield
    await jobs.stop(tasks)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Cleaning Platform API",
        version="0.1.0",
        generate_unique_id_function=_operation_id,
        lifespan=_lifespan,
    )
    origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
            allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        )
    app.add_exception_handler(AppError, app_error_handler)
    for r in (
        auth.router,
        catalog.router,
        addresses.router,
        bookings.router,
        subscriptions.router,
        staff_self.router,
        notifications.router,
        admin.router,
    ):
        app.include_router(r)

    @app.get("/healthz", tags=["ops"], name="ops_health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
