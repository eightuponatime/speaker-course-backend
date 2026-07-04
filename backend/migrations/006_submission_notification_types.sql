alter table notifications
    drop constraint if exists notifications_type_check;

alter table notifications
    add constraint notifications_type_check
    check (
        type in (
            'course_enrollment_requested',
            'course_access_approved',
            'course_access_rejected',
            'course_access_revoked',
            'course_access_restored',
            'lesson_submission_sent',
            'lesson_submission_commented',
            'lesson_submission_status_updated'
        )
    );
