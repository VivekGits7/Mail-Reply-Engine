import io
from typing import Any, Dict, List, Optional, Tuple

from app.ai import FeedbackAnalysis

EMAIL_HEADERS = ("email", "e-mail", "respondent", "responder")
SCORE_HEADERS = ("score", "rating", "overall")


def find_column(headers: List[str], names: Tuple[str, ...]) -> Optional[int]:
    for index, header in enumerate(headers):
        if any(name in header for name in names):
            return index
    return None


def row_score(
    headers: List[str], row: List[Any], score_index: Optional[int]
) -> Optional[float]:
    if score_index is not None:
        try:
            return float(row[score_index])
        except (TypeError, ValueError, IndexError):
            return None
    numbers = []
    for index, value in enumerate(row):
        if index < len(headers) and (
            "id" == headers[index] or "time" in headers[index]
        ):
            continue
        if (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and 0 <= value <= 10
        ):
            numbers.append(float(value))
    return round(sum(numbers) / len(numbers), 2) if numbers else None


def answers_of(headers: List[str], row: List[Any], skip: set[int]) -> Dict[str, Any]:
    return {
        headers[i] or f"column_{i + 1}": row[i]
        for i in range(min(len(headers), len(row)))
        if i not in skip and row[i] not in (None, "")
    }


def build_pdf(
    title: str, period: str, count: int, analysis: Optional[FeedbackAnalysis]
) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import (
        ListFlowable,
        ListItem,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
    )

    styles = getSampleStyleSheet()
    buffer = io.BytesIO()
    story = [
        Paragraph(title, styles["Title"]),
        Paragraph(f"{period}, {count} responses", styles["Normal"]),
        Spacer(1, 12),
    ]
    if analysis is None:
        story.append(
            Paragraph("No survey responses arrived in this period.", styles["Normal"])
        )
    else:
        story += [
            Paragraph("Summary", styles["Heading2"]),
            Paragraph(analysis.summary, styles["Normal"]),
        ]
        for heading, items in (
            ("Themes", analysis.themes),
            ("What is working", analysis.working_well),
            ("What is not working", analysis.not_working),
            ("Suggested actions", analysis.suggested_actions),
        ):
            story.append(Paragraph(heading, styles["Heading2"]))
            story.append(
                ListFlowable(
                    [ListItem(Paragraph(item, styles["Normal"])) for item in items]
                    or [ListItem(Paragraph("Nothing noted", styles["Normal"]))],
                    bulletType="bullet",
                )
            )
    SimpleDocTemplate(buffer, pagesize=A4, title=title).build(story)
    return buffer.getvalue()
