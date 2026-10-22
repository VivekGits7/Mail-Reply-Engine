from typing import Any, Dict, List

CHECKLIST_DEFAULTS: Dict[str, List[Dict[str, Any]]] = {
    "campus": [
        {"document_type": "pan_card", "is_mandatory": True, "check_mode": "text"},
        {"document_type": "aadhaar_card", "is_mandatory": True, "check_mode": "text"},
        {
            "document_type": "passport_photo",
            "is_mandatory": True,
            "check_mode": "photo",
        },
        {
            "document_type": "class_10_certificate",
            "is_mandatory": True,
            "check_mode": "text",
        },
        {
            "document_type": "class_12_certificate",
            "is_mandatory": True,
            "check_mode": "text",
        },
        {
            "document_type": "degree_certificate",
            "is_mandatory": True,
            "check_mode": "text",
        },
        {"document_type": "marksheets", "is_mandatory": True, "check_mode": "text"},
        {"document_type": "resume", "is_mandatory": False, "check_mode": "text"},
    ],
    "lateral": [
        {"document_type": "pan_card", "is_mandatory": True, "check_mode": "text"},
        {"document_type": "aadhaar_card", "is_mandatory": True, "check_mode": "text"},
        {
            "document_type": "passport_photo",
            "is_mandatory": True,
            "check_mode": "photo",
        },
        {
            "document_type": "class_10_certificate",
            "is_mandatory": True,
            "check_mode": "text",
        },
        {
            "document_type": "class_12_certificate",
            "is_mandatory": True,
            "check_mode": "text",
        },
        {
            "document_type": "degree_certificate",
            "is_mandatory": True,
            "check_mode": "text",
        },
        {
            "document_type": "relieving_letter",
            "is_mandatory": True,
            "check_mode": "text",
        },
        {
            "document_type": "experience_letter",
            "is_mandatory": False,
            "check_mode": "text",
        },
        {"document_type": "resume", "is_mandatory": False, "check_mode": "text"},
    ],
}

INDUCTION_DEFAULTS: Dict[str, List[Dict[str, Any]]] = {
    "campus": [
        {
            "title": "HR orientation",
            "owner_email": "hr_owner",
            "duration_mins": 60,
            "day_number": 1,
        },
        {
            "title": "IT orientation",
            "owner_email": "it_team",
            "duration_mins": 60,
            "day_number": 1,
        },
        {
            "title": "Meet your manager",
            "owner_email": "manager",
            "duration_mins": 45,
            "day_number": 1,
        },
        {
            "title": "Company overview",
            "owner_email": "hr_owner",
            "duration_mins": 60,
            "day_number": 2,
        },
        {
            "title": "Policies and benefits",
            "owner_email": "hr_owner",
            "duration_mins": 60,
            "day_number": 2,
        },
        {
            "title": "Delivery process",
            "owner_email": "hr_onboarding_owner",
            "duration_mins": 90,
            "day_number": 3,
        },
        {
            "title": "Security and compliance",
            "owner_email": "it_team",
            "duration_mins": 60,
            "day_number": 4,
        },
        {
            "title": "Project onboarding",
            "owner_email": "manager",
            "duration_mins": 60,
            "day_number": 5,
        },
    ],
    "mid": [
        {
            "title": "HR orientation",
            "owner_email": "hr_owner",
            "duration_mins": 60,
            "day_number": 1,
        },
        {
            "title": "IT orientation",
            "owner_email": "it_team",
            "duration_mins": 45,
            "day_number": 1,
        },
        {
            "title": "Meet your manager",
            "owner_email": "manager",
            "duration_mins": 45,
            "day_number": 1,
        },
        {
            "title": "Policies and security",
            "owner_email": "hr_owner",
            "duration_mins": 60,
            "day_number": 2,
        },
    ],
    "senior": [
        {
            "title": "HR orientation",
            "owner_email": "hr_owner",
            "duration_mins": 60,
            "day_number": 1,
        },
        {
            "title": "IT orientation",
            "owner_email": "it_team",
            "duration_mins": 45,
            "day_number": 1,
        },
        {
            "title": "Meet your manager",
            "owner_email": "manager",
            "duration_mins": 45,
            "day_number": 1,
        },
    ],
}
