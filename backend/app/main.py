from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


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


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "debug": settings.app_debug,
    }
