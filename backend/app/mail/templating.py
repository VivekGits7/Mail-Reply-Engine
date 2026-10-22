from typing import Any, Dict, Optional, Tuple

from jinja2 import (
    Environment,
    StrictUndefined,
    TemplateSyntaxError,
    UndefinedError,
    meta,
)
from markupsafe import Markup, escape

from app.config import settings
from app.error import BadRequestException
from app.mail.defaults import GLOBAL_PLACEHOLDERS, TEMPLATE_DEFAULTS
from app.mail.model import Template

_html_env = Environment(autoescape=True, undefined=StrictUndefined)
_text_env = Environment(autoescape=False, undefined=StrictUndefined)


class TemplateRenderError(Exception):
    pass


def allowed_placeholders(template_key: str) -> set[str]:
    default = TEMPLATE_DEFAULTS.get(template_key)
    return set(GLOBAL_PLACEHOLDERS) | set(default.placeholders if default else [])


def validate_source(
    template_key: str, subject: Optional[str], body_html: Optional[str]
) -> None:
    allowed = allowed_placeholders(template_key)
    for label, source, env in (
        ("subject", subject, _text_env),
        ("body", body_html, _html_env),
    ):
        if source is None:
            continue
        try:
            used = meta.find_undeclared_variables(env.parse(source))
        except TemplateSyntaxError as e:
            raise BadRequestException(
                f"The {label} has a template error on line {e.lineno}"
            ) from e
        unknown = sorted(used - allowed)
        if unknown:
            raise BadRequestException(
                f"Unknown placeholder in the {label}: {', '.join(unknown)}"
            )


def base_values() -> Dict[str, Any]:
    return {
        "company_name": settings.COMPANY_NAME,
        "dashboard_link": settings.FRONTEND_URL,
    }


def render_source(
    subject: str, body_html: str, values: Dict[str, Any]
) -> Tuple[str, str]:
    merged = {**base_values(), **values}
    try:
        rendered_subject = _text_env.from_string(subject).render(**merged)
        rendered_body = _html_env.from_string(body_html).render(**merged)
    except UndefinedError as e:
        raise TemplateRenderError(str(e)) from e
    return " ".join(rendered_subject.split()), rendered_body


async def render(template_key: str, values: Dict[str, Any]) -> Tuple[str, str]:
    template = await Template.find(template_key)
    if template is None or not template.is_active:
        default = TEMPLATE_DEFAULTS.get(template_key)
        if default is None or (template is not None and not template.is_active):
            raise TemplateRenderError(f"Template {template_key} is missing or inactive")
        return render_source(default.subject, default.body_html, values)
    return render_source(template.subject, template.body_html, values)


def html_list(items: list[str]) -> Markup:
    if not items:
        return Markup("")
    return (
        Markup("<ul>")
        + Markup("").join(
            Markup("<li>") + escape(item) + Markup("</li>") for item in items
        )
        + Markup("</ul>")
    )


def html_table(rows: list[tuple[str, Any]]) -> Markup:
    cells = Markup("").join(
        Markup(
            '<tr><td style="border:1px solid #999;padding:4px 8px;font-weight:bold">'
        )
        + escape(label)
        + Markup('</td><td style="border:1px solid #999;padding:4px 8px">')
        + escape("" if value is None else value)
        + Markup("</td></tr>")
        for label, value in rows
    )
    return (
        Markup('<table style="border-collapse:collapse">') + cells + Markup("</table>")
    )


def html_grid(headers: list[str], rows: list[list[Any]]) -> Markup:
    head = Markup("").join(
        Markup('<th style="border:1px solid #999;padding:4px 8px">')
        + escape(h)
        + Markup("</th>")
        for h in headers
    )
    body = Markup("").join(
        Markup("<tr>")
        + Markup("").join(
            Markup('<td style="border:1px solid #999;padding:4px 8px">')
            + escape(cell)
            + Markup("</td>")
            for cell in row
        )
        + Markup("</tr>")
        for row in rows
    )
    return (
        Markup('<table style="border-collapse:collapse"><tr>')
        + head
        + Markup("</tr>")
        + body
        + Markup("</table>")
    )


async def seed_templates() -> None:
    for key, default in TEMPLATE_DEFAULTS.items():
        await Template.insert_missing(
            key, default.name, default.subject, default.body_html, default.placeholders
        )
