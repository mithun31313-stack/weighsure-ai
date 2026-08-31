from sqlalchemy.orm import Session

from app.models.user import User, RoleEnum
from app.models.settings import Notification


def notify_reviewers_pending(db: Session, test) -> None:
    """Creates an in-app notification for every Reviewer/Admin when a test enters UNDER_REVIEW."""
    recipients = (
        db.query(User)
        .filter(User.role.in_([RoleEnum.REVIEWER, RoleEnum.ADMIN]), User.is_active == True)  # noqa: E712
        .all()
    )
    for user in recipients:
        db.add(Notification(
            user_id=user.id,
            title=f"Test {test.test_code} awaiting review",
            body=f"Instrument: {test.instrument.model} ({test.instrument.serial_number})",
            link=f"/tests/{test.id}",
        ))
    db.commit()
