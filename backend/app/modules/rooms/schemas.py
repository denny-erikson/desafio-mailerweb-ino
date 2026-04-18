from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RoomCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    capacity: int = Field(gt=0)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Room name cannot be empty")

        return normalized


class RoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    capacity: int
    created_at: datetime
    updated_at: datetime
