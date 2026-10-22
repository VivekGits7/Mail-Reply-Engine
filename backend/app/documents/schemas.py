from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field

from app.common.enums import PersonCheck


class ExtractedDocument(BaseModel):
    text: str = Field(default="", description="Extracted text, kept in memory only")
    chars: int = Field(default=0, description="Characters of real text")
    ocr_confidence: Optional[float] = Field(
        default=None, description="Mean OCR word confidence when OCR ran"
    )
    method: str = Field(
        default="unsupported",
        description="pdf_text, pdf_ocr, docx, image_ocr, text, ocr_unavailable or unsupported",
    )
    pages: int = Field(default=0, description="Pages or images read")


class PersonCheckResult(BaseModel):
    result: PersonCheck = Field(..., description="match, mismatch or not_found")
    name_score: Optional[float] = Field(
        default=None, description="Best fuzzy name score out of 100"
    )
    dob_match: Optional[bool] = Field(
        default=None, description="Whether a labelled date of birth matched"
    )
    pan_match: Optional[bool] = Field(
        default=None, description="Whether a PAN matched the known PAN hash"
    )
    pans: List[str] = Field(
        default_factory=list,
        description="PAN numbers found, used once to set the PAN hash",
    )
    dobs: List[date] = Field(
        default_factory=list, description="Labelled dates of birth found"
    )
