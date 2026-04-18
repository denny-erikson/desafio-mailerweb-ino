from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.models import User
from app.db.session import SessionLocal


def seed_initial_user() -> None:
    settings = get_settings()

    with SessionLocal() as db:
        user = db.scalar(
            select(User).where(User.email == settings.initial_user_email),
        )

        if user is None:
            user = User(
                email=settings.initial_user_email,
                full_name=settings.initial_user_full_name,
                password_hash=get_password_hash(settings.initial_user_password),
                is_active=True,
            )
            db.add(user)
            action = "created"
        else:
            user.full_name = settings.initial_user_full_name
            user.password_hash = get_password_hash(settings.initial_user_password)
            user.is_active = True
            action = "updated"

        db.commit()
        db.refresh(user)

    print(
        f"Initial user {action}: "
        f"email={settings.initial_user_email} id={user.id}",
    )


if __name__ == "__main__":
    seed_initial_user()
