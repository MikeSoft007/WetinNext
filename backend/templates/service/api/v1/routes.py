from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["New domain"])


class ServiceInfo(BaseModel):
    name: str
    status: str


@router.get("/info", response_model=ServiceInfo)
def info():
    """Replace with a domain contract, service layer and owned repository."""
    return ServiceInfo(name="new-domain", status="boilerplate")
