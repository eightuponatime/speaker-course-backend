update users
set role = 'admin'
where email = 'satanov201354@gmail.com';

insert into courses (id, author_id, title, slug, description, status)
values (
    '10000000-0000-0000-0000-000000000001',
    (select id from users where email = 'satanov201354@gmail.com'),
    'Homemade Bagels for Beginners',
    'homemade-bagels-for-beginners',
    'A beginner-friendly course about homemade bagels.',
    'draft'
)
on conflict (slug) do update
set title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    updated_at = now();

insert into course_sections (id, course_id, title, position)
values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Introduction', 1),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Preparing the dough', 2)
on conflict (course_id, position) do update
set title = excluded.title,
    updated_at = now();

insert into lessons (
    id,
    course_id,
    section_id,
    title,
    slug,
    position,
    status,
    draft_content
)
values
    (
        '30000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        'Welcome to the course!',
        'welcome-to-the-course',
        1,
        'draft',
        '{"blocks":[{"type":"paragraph","data":{"text":"Welcome to the course!"}}]}'::jsonb
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        'What makes a bagel a bagel?',
        'what-makes-a-bagel-a-bagel',
        2,
        'draft',
        '{"blocks":[{"type":"paragraph","data":{"text":"A short introduction to bagel texture, shape, and boiling."}}]}'::jsonb
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        'Tools & ingredients',
        'tools-and-ingredients',
        3,
        'draft',
        '{"blocks":[{"type":"paragraph","data":{"text":"Tools and ingredients for the course."}}]}'::jsonb
    ),
    (
        '30000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000002',
        'Bagel dough 101',
        'bagel-dough-101',
        1,
        'draft',
        '{"blocks":[{"type":"paragraph","data":{"text":"The basics of bagel dough."}}]}'::jsonb
    )
on conflict (course_id, slug) do update
set title = excluded.title,
    section_id = excluded.section_id,
    position = excluded.position,
    draft_content = excluded.draft_content,
    updated_at = now();
