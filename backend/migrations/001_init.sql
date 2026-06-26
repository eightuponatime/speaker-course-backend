create extension if not exists "uuid-ossp";

create table users (
    id uuid primary key default uuid_generate_v4(),
    google_sub text unique,
    email text not null unique,
    password text,
    full_name text not null,
    role text not null check (role in ('admin', 'member')),
    created_at timestamptz not null default now()
);

create table sessions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references users(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    constraint sessions_expires_after_created check (expires_at > created_at)
);

create table courses (
    id uuid primary key default uuid_generate_v4(),
    author_id uuid not null references users(id) on delete restrict,
    title text not null,
    slug text not null unique,
    description text not null default '',
    status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
    cover_image_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz
);

create table course_sections (
    id uuid primary key default uuid_generate_v4(),
    course_id uuid not null references courses(id) on delete cascade,
    title text not null,
    position integer not null check (position > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, course_id),
    unique (course_id, position)
);

create table lessons (
    id uuid primary key default uuid_generate_v4(),
    course_id uuid not null references courses(id) on delete cascade,
    section_id uuid not null,
    title text not null,
    slug text not null,
    position integer not null check (position > 0),
    status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
    draft_content jsonb not null default '{"blocks":[]}'::jsonb,
    published_content jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz,
    foreign key (section_id, course_id) references course_sections(id, course_id) on delete cascade,
    unique (section_id, position),
    unique (course_id, slug),
    constraint lessons_draft_content_is_object check (jsonb_typeof(draft_content) = 'object'),
    constraint lessons_published_content_is_object check (
        published_content is null or jsonb_typeof(published_content) = 'object'
    )
);

create table media_assets (
    id uuid primary key default uuid_generate_v4(),
    owner_id uuid not null references users(id) on delete restrict,
    course_id uuid references courses(id) on delete cascade,
    lesson_id uuid references lessons(id) on delete cascade,
    kind text not null check (kind in ('image', 'video', 'pdf', 'file')),
    original_name text not null,
    mime_type text not null,
    size_bytes bigint not null check (size_bytes > 0),
    storage_key text not null unique,
    public_url text not null,
    created_at timestamptz not null default now()
);

create table course_enrollments (
    id uuid primary key default uuid_generate_v4(),
    course_id uuid not null references courses(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    status text not null default 'pending' 
        check (status in ('pending', 'approved', 'rejected', 'revoked')),

    requested_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references users(id) on delete set null,
    admin_note text,

    unique (course_id, user_id)
);

create table lesson_progress (
    id uuid primary key default uuid_generate_v4(),
    lesson_id uuid not null references lessons(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    first_viewed_at timestamptz not null default now(),
    completed_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (lesson_id, user_id)
);

create table course_student_activity (
    course_id uuid not null references courses(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    current_lesson_id uuid references lessons(id) on delete set null,
    last_seen_at timestamptz not null default now(),
    online_until timestamptz,
    first_access_at timestamptz,
    access_expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (course_id, user_id)
);

create table lesson_quiz_responses (
    id uuid primary key default uuid_generate_v4(),
    lesson_id uuid not null references lessons(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    quiz_id text not null,
    selected_option_index integer not null check (selected_option_index >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (lesson_id, user_id, quiz_id)
);

create table notifications (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references users(id) on delete cascade,
    actor_id uuid references users(id) on delete set null,
    course_id uuid references courses(id) on delete cascade,
    enrollment_id uuid references course_enrollments(id) on delete cascade,
    type text not null check (
        type in (
            'course_enrollment_requested',
            'course_access_approved',
            'course_access_rejected',
            'course_access_revoked',
            'course_access_restored'
        )
    ),
    title text not null,
    body text not null default '',
    read_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz not null default now()
);

create index sessions_user_id_idx on sessions(user_id);
create index course_sections_course_id_position_idx on course_sections(course_id, position);
create index lessons_course_id_idx on lessons(course_id);
create index lessons_section_id_position_idx on lessons(section_id, position);
create index media_assets_course_id_idx on media_assets(course_id);
create index media_assets_lesson_id_idx on media_assets(lesson_id);
create index course_enrollments_user_id_idx on course_enrollments(user_id);
create index course_enrollments_course_id_status_idx on course_enrollments(course_id, status);
create index lesson_progress_user_id_idx on lesson_progress(user_id);
create index course_student_activity_course_seen_idx on course_student_activity(course_id, last_seen_at desc);
create index course_student_activity_user_id_idx on course_student_activity(user_id);
create index lesson_quiz_responses_user_id_idx on lesson_quiz_responses(user_id);
create index notifications_user_id_created_at_idx on notifications(user_id, created_at desc)
    where deleted_at is null;
create index notifications_user_id_unread_idx on notifications(user_id)
    where read_at is null and deleted_at is null;

insert into users (id, google_sub, email, password, full_name, role)
values (
    '00000000-0000-0000-0000-000000000001',
    null,
    'system@logos-voice.local',
    null,
    'Logos Voice',
    'admin'
)
on conflict (email) do update
set full_name = excluded.full_name,
    role = excluded.role;

insert into courses (id, author_id, title, slug, description, status)
select
    '10000000-0000-0000-0000-000000000001',
    (select id from users where email = 'system@logos-voice.local'),
    'Курсы ораторского мастерства',
    'logos-voice',
    'Риторика, влияние и публичная речь.',
    'draft'
where not exists (
    select 1
    from courses
    where status <> 'archived'
)
on conflict (id) do nothing;
