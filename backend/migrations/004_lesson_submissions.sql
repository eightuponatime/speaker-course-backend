create table lesson_submissions (
    id uuid primary key default uuid_generate_v4(),
    lesson_id uuid not null references lessons(id) on delete cascade,
    course_id uuid not null references courses(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'accepted', 'needs_revision')),
    body text not null default '',
    attachments jsonb not null default '[]'::jsonb,
    viewed_by_admin_at timestamptz,
    viewed_by_student_at timestamptz,
    submitted_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (lesson_id, user_id),
    constraint lesson_submissions_attachments_is_array check (jsonb_typeof(attachments) = 'array')
);

create table lesson_submission_comments (
    id uuid primary key default uuid_generate_v4(),
    submission_id uuid not null references lesson_submissions(id) on delete cascade,
    author_id uuid not null references users(id) on delete cascade,
    body text not null default '',
    attachments jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    constraint lesson_submission_comments_attachments_is_array check (jsonb_typeof(attachments) = 'array')
);

create index lesson_submissions_course_updated_idx
    on lesson_submissions(course_id, updated_at desc);

create index lesson_submissions_user_lesson_idx
    on lesson_submissions(user_id, lesson_id);

create index lesson_submissions_admin_unread_idx
    on lesson_submissions(course_id, updated_at desc)
    where viewed_by_admin_at is null or viewed_by_admin_at < updated_at;

create index lesson_submission_comments_submission_created_idx
    on lesson_submission_comments(submission_id, created_at);
