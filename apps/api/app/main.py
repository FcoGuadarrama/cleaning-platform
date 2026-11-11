import asyncio
import contextlib
import os
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.core.config import get_settings
from app.core.errors import AppError, app_error_handler
from app.jobs import sweep_holds_forever
from app.routers import addresses, admin, auth, bookings, catalog, staff_self, subscriptions


def _operation_id(route: APIRoute) -> str:
    return route.name


@contextlib.asynccontextmanager
async def _lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Runs the hold sweeper next to the API; HOLD_SWEEP_INTERVAL_SECONDS=0 turns it off."""
    interval = get_settings().hold_sweep_interval_seconds
    sweeper = asyncio.create_task(sweep_holds_forever(interval)) if interval > 0 else None
    yield
    if sweeper is not None:
        sweeper.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await sweeper


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
        admin.router,
    ):
        app.include_router(r)

    @app.get("/healthz", tags=["ops"], name="ops_health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
