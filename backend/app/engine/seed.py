from app.admin.model import seed_admin_defaults
from app.mail.templating import seed_templates
from app.workflows.reminders.service import seed_rules


async def seed_defaults() -> None:
    await seed_templates()
    await seed_admin_defaults()
    await seed_rules()
