alter table notifications
    add column if not exists lesson_id uuid references lessons(id) on delete cascade,
    add column if not exists submission_id uuid references lesson_submissions(id) on delete cascade;

create index if not exists notifications_lesson_id_idx on notifications(lesson_id);
create index if not exists notifications_submission_id_idx on notifications(submission_id);