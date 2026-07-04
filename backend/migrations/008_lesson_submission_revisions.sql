create table if not exists lesson_submission_revisions (
    id uuid primary key default uuid_generate_v4(),
    submission_id uuid not null references lesson_submissions(id) on delete cascade,
    editor_id uuid not null references users(id) on delete cascade,
    previous_body text not null default '',
    previous_attachments jsonb not null default '[]'::jsonb,
    next_body text not null default '',
    next_attachments jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    constraint lesson_submission_revisions_previous_attachments_is_array check (jsonb_typeof(previous_attachments) = 'array'),
    constraint lesson_submission_revisions_next_attachments_is_array check (jsonb_typeof(next_attachments) = 'array')
);

create index if not exists lesson_submission_revisions_submission_created_idx
    on lesson_submission_revisions(submission_id, created_at desc);
