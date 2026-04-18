from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.modules.auth.router import router as auth_router
from app.modules.rooms.router import router as rooms_router


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
)

if settings.cors_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(rooms_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "debug": settings.app_debug,
    }
