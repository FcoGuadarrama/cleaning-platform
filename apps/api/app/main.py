from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.core.errors import AppError, app_error_handler
from app.routers import admin, auth, bookings, catalog, staff_self


def _operation_id(route: APIRoute) -> str:
    return route.name


def create_app() -> FastAPI:
    app = FastAPI(title="Cleaning Platform API", version="0.1.0", generate_unique_id_function=_operation_id)
    app.add_exception_handler(AppError, app_error_handler)
    for r in (auth.router, catalog.router, bookings.router, staff_self.router, admin.router):
        app.include_router(r)

    @app.get("/healthz", tags=["ops"], name="ops_health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
