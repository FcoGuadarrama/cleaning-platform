from fastapi import APIRouter

from app.core.errors import ERROR_RESPONSES
from app.deps import SessionDep, UserDep
from app.models import Role
from app.schemas import LoginRequest, RegisterRequest, TokenOut, UserOut
from app.services import auth

router = APIRouter(prefix="/auth", tags=["auth"], responses=ERROR_RESPONSES)


@router.post("/register", status_code=201, name="auth_register")
async def register(body: RegisterRequest, session: SessionDep) -> TokenOut:
    """Public signup: always creates a customer account."""
    async with session.begin():
        user = await auth.create_user(session, body.email, body.password, body.full_name, Role.customer)
        token, row = await auth.issue_token(session, user)
    return TokenOut(access_token=token, expires_at=row.expires_at, user=UserOut.model_validate(user))


@router.post("/login", name="auth_login")
async def login(body: LoginRequest, session: SessionDep) -> TokenOut:
    async with session.begin():
        token, row, user = await auth.login(session, body.email, body.password)
    return TokenOut(access_token=token, expires_at=row.expires_at, user=UserOut.model_validate(user))


@router.get("/me", name="auth_me")
async def me(user: UserDep) -> UserOut:
    return UserOut.model_validate(user)
