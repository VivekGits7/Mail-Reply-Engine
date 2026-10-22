from pydantic import BaseModel, ConfigDict, Field, field_validator


class FileAttachment(BaseModel):
    file_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Original file name",
        examples=["pending.xlsx"],
    )
    file_url: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="Storage key returned by the presign endpoint",
        examples=["uploads/reminder_list/0b7c.xlsx"],
    )
    mime_type: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="MIME type of the file",
        examples=["application/pdf"],
    )
    size: int = Field(..., ge=1, description="File size in bytes", examples=[20480])

    @field_validator("file_name", "file_url", "mime_type")
    @classmethod
    def strip_value(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("cannot be empty")
        return value

    @field_validator("mime_type")
    @classmethod
    def lower_mime(cls, value: str) -> str:
        return value.lower()

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "file_name": "appointment.pdf",
                "file_url": "uploads/appointment_letter/0b7c4f2e.pdf",
                "mime_type": "application/pdf",
                "size": 120000,
            }
        }
    )
