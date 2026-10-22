from datetime import date, timedelta
from typing import Any, Dict

from httpx import AsyncClient

from app.ai import schemas as ai_schemas

DOC_KEYWORDS = [
    ("income tax department", "pan_card"),
    ("unique identification authority", "aadhaar_card"),
    ("bachelor of", "degree_certificate"),
    ("higher secondary", "class_12_certificate"),
    ("secondary school", "class_10_certificate"),
    ("statement of marks", "marksheets"),
    ("relieving", "relieving_letter"),
    ("experience letter", "experience_letter"),
    ("curriculum vitae", "resume"),
]


def joiner_payload(**overrides: Any) -> Dict[str, Any]:
    payload = {
        "full_name": "Rahul Sharma",
        "personal_email": "rahul.sharma@gmail.com",
        "recruiter_email": "recruiter@tcgdigital.com",
        "hire_category": "lateral",
        "location": "Kolkata",
        "level": "L4",
        "joining_date": (date.today() + timedelta(days=30)).isoformat(),
        "date_of_birth": "1990-02-20",
        "manager_name": "Amit Roy",
        "manager_email": "amit.roy@tcgdigital.com",
    }
    payload.update(overrides)
    return payload


async def create_joiner(
    client: AsyncClient, headers: Dict[str, str], **overrides: Any
) -> Dict[str, Any]:
    response = await client.post(
        "/api/joiners", json=joiner_payload(**overrides), headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def smart_identify(text: str) -> ai_schemas.IdentifyResult:
    lowered = text.lower()
    for keyword, document_type in DOC_KEYWORDS:
        if keyword in lowered:
            return ai_schemas.IdentifyResult(
                document_type=document_type, confidence=0.95, issues=[]
            )
    return ai_schemas.IdentifyResult(document_type="other", confidence=0.9, issues=[])


def pan_text(
    name: str = "Rahul Sharma", dob: str = "20/02/1990", pan: str = "ABCDE1234F"
) -> str:
    return f"INCOME TAX DEPARTMENT\nGOVT OF INDIA\nPermanent Account Number Card\nName: {name}\nDate of Birth: {dob}\nPAN: {pan}\nSignature"


def aadhaar_text(name: str = "Rahul Sharma", dob: str = "20/02/1990") -> str:
    return f"Unique Identification Authority of India\nName: {name}\nDOB: {dob}\nMale\n2345 6789 0123\nMera Aadhaar Meri Pehchan"


def certificate_text(kind: str, name: str = "Rahul Sharma") -> str:
    titles = {
        "class_10_certificate": "Secondary School Examination Certificate",
        "class_12_certificate": "Higher Secondary Examination Certificate",
        "degree_certificate": "Bachelor of Technology Degree Certificate",
        "marksheets": "Statement of Marks for all semesters",
        "relieving_letter": "Relieving letter, this is to certify the employee is relieved from duties",
    }
    return f"{titles[kind]}\nThis certifies the candidate below completed the programme.\nName: {name}\nAwarded with distinction by the board of examinations."


def sign_off_payload(**overrides: Any) -> Dict[str, Any]:
    payload = {
        "employee_code": "32700",
        "designation": "Senior Manager",
        "project_code": "Delivery 2.0",
        "gender": "Male",
        "blood_group": "B+",
        "date_of_marriage": None,
        "bu_head": "Neha Gupta",
        "employment_type": "Permanent",
        "contact_number": "9000000000",
        "sector_region": "India",
        "system_type": True,
        "proj_ops": False,
        "ess_d365": True,
        "skills": "Kafka, Elastic Search",
        "business_card": True,
        "force_reason": None,
    }
    payload.update(overrides)
    return payload
