from typing import Optional

from pydantic import BaseModel, Field

from app.people.model import Person

PERSON_EXAMPLE = {
    "person_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "full_name": "Rahul Sharma",
    "personal_email": "rahul.sharma@gmail.com",
    "work_email": "rahul.sharma@tcgdigital.com",
    "employee_code": "32700",
    "designation": "Senior Manager",
    "level": "L4",
    "location": "Kolkata",
    "hire_category": "lateral",
    "joining_date": "2026-11-16",
    "date_of_birth": "1990-02-20",
    "manager_name": "Amit Roy",
    "manager_email": "amit.roy@tcgdigital.com",
    "recruiter_email": "recruiter@tcgdigital.com",
    "role": "candidate",
    "status": "active",
}


class PersonData(BaseModel):
    person_id: str = Field(
        ...,
        description="Person UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    full_name: str = Field(..., description="Full name", examples=["Rahul Sharma"])
    personal_email: Optional[str] = Field(
        default=None, description="Personal email", examples=["rahul.sharma@gmail.com"]
    )
    work_email: Optional[str] = Field(
        default=None,
        description="Work email once IT creates it",
        examples=["rahul.sharma@tcgdigital.com"],
    )
    employee_code: Optional[str] = Field(
        default=None, description="Employee ID", examples=["32700"]
    )
    designation: Optional[str] = Field(
        default=None, description="Designation", examples=["Senior Manager"]
    )
    level: Optional[str] = Field(default=None, description="Level", examples=["L4"])
    location: Optional[str] = Field(
        default=None, description="Base location", examples=["Kolkata"]
    )
    hire_category: Optional[str] = Field(
        default=None, description="campus or lateral", examples=["lateral"]
    )
    joining_date: Optional[str] = Field(
        default=None, description="Joining date", examples=["2026-11-16"]
    )
    date_of_birth: Optional[str] = Field(
        default=None, description="Date of birth", examples=["1990-02-20"]
    )
    manager_name: Optional[str] = Field(
        default=None, description="Reporting manager", examples=["Amit Roy"]
    )
    manager_email: Optional[str] = Field(
        default=None,
        description="Reporting manager email",
        examples=["amit.roy@tcgdigital.com"],
    )
    recruiter_email: Optional[str] = Field(
        default=None,
        description="Recruiter email",
        examples=["recruiter@tcgdigital.com"],
    )
    role: str = Field(
        ...,
        description="candidate, employee, stakeholder or manager",
        examples=["candidate"],
    )
    status: str = Field(
        ..., description="active, exiting, exited or dropped", examples=["active"]
    )


def to_person_data(person: Person) -> PersonData:
    return PersonData(
        person_id=str(person.person_id),
        full_name=person.full_name,
        personal_email=person.personal_email,
        work_email=person.work_email,
        employee_code=person.employee_code,
        designation=person.designation,
        level=person.level,
        location=person.location,
        hire_category=person.hire_category.value if person.hire_category else None,
        joining_date=person.joining_date.isoformat() if person.joining_date else None,
        date_of_birth=person.date_of_birth.isoformat()
        if person.date_of_birth
        else None,
        manager_name=person.manager_name,
        manager_email=person.manager_email,
        recruiter_email=person.recruiter_email,
        role=person.role.value,
        status=person.status.value,
    )
