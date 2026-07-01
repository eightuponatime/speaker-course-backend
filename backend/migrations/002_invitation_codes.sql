create table course_invitation_codes (
    id uuid primary key default uuid_generate_v4(),
    course_id uuid not null references courses(id) on delete cascade,
    code text not null unique,
    created_by uuid references users(id) on delete set null,
    used_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    used_at timestamptz,
    constraint course_invitation_codes_expires_after_created check (expires_at > created_at)
);

create index course_invitation_codes_course_created_idx
    on course_invitation_codes(course_id, created_at desc);

create index course_invitation_codes_active_idx
    on course_invitation_codes(course_id, expires_at)
    where used_at is null;
