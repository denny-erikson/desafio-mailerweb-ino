from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.db.enums import BookingStatus


class BookingParticipantInput(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("Participant email must be valid")

        return normalized

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class BookingBaseRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    room_id: int
    start_at: datetime
    end_at: datetime
    participants: list[BookingParticipantInput] = Field(min_length=1)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Booking title cannot be empty")

        return normalized

    @model_validator(mode="after")
    def validate_unique_participants(self) -> "BookingBaseRequest":
        emails = [participant.email for participant in self.participants]
        if len(emails) != len(set(emails)):
            raise ValueError("Participants must have unique emails")

        return self


class BookingCreateRequest(BookingBaseRequest):
    pass


class BookingUpdateRequest(BookingBaseRequest):
    pass


class BookingParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None
    created_at: datetime


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    room_id: int
    created_by_user_id: int
    start_at: datetime
    end_at: datetime
    status: BookingStatus
    canceled_at: datetime | None
    created_at: datetime
    updated_at: datetime
    participants: list[BookingParticipantResponse]
