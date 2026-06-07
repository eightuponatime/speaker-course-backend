insert into users (id, google_sub, email, password, full_name, role)
values
    (
        '40000000-0000-0000-0000-000000000001',
        null,
        'aigerim.nurlybekova@example.com',
        '$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS',
        'Aigerim Nurlybekova',
        'member'
    ),
    (
        '40000000-0000-0000-0000-000000000002',
        null,
        'daniyar.sadykov@example.com',
        '$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS',
        'Daniyar Sadykov',
        'member'
    ),
    (
        '40000000-0000-0000-0000-000000000003',
        null,
        'aliya.kasenova@example.com',
        '$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS',
        'Aliya Kasenova',
        'member'
    ),
    (
        '40000000-0000-0000-0000-000000000004',
        null,
        'timur.valikhanov@example.com',
        '$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS',
        'Timur Valikhanov',
        'member'
    ),
    (
        '40000000-0000-0000-0000-000000000005',
        null,
        'madina.ermekova@example.com',
        '$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS',
        'Madina Ermekova',
        'member'
    ),
    (
        '40000000-0000-0000-0000-000000000006',
        null,
        'arsen.bekzhan@example.com',
        '$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS',
        'Arsen Bekzhan',
        'member'
    ),
    (
        '40000000-0000-0000-0000-000000000007',
        null,
        'zhanar.murat@example.com',
        '$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS',
        'Zhanar Murat',
        'member'
    ),
    (
        '40000000-0000-0000-0000-000000000008',
        null,
        'eldar.rakhimov@example.com',
        '$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS',
        'Eldar Rakhimov',
        'member'
    )
on conflict (email) do update
set password = excluded.password,
    full_name = excluded.full_name,
    role = excluded.role;

insert into course_enrollments (
    course_id,
    user_id,
    status,
    requested_at,
    reviewed_at,
    reviewed_by,
    admin_note
)
values
    (
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        'pending',
        now() - interval '2 hours',
        null,
        null,
        null
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000002',
        'pending',
        now() - interval '8 hours',
        null,
        null,
        null
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000003',
        'pending',
        now() - interval '1 day',
        null,
        null,
        null
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000004',
        'approved',
        now() - interval '4 days',
        now() - interval '3 days 20 hours',
        (select id from users where email = 'satanov201354@gmail.com'),
        'Approved after manual review.'
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000005',
        'approved',
        now() - interval '6 days',
        now() - interval '5 days 23 hours',
        (select id from users where email = 'satanov201354@gmail.com'),
        'Existing student from the intro webinar.'
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000006',
        'rejected',
        now() - interval '7 days',
        now() - interval '6 days 18 hours',
        (select id from users where email = 'satanov201354@gmail.com'),
        'Rejected for duplicate registration details.'
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000007',
        'revoked',
        now() - interval '12 days',
        now() - interval '1 day',
        (select id from users where email = 'satanov201354@gmail.com'),
        'Access revoked by admin request.'
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000008',
        'pending',
        now() - interval '20 minutes',
        null,
        null,
        null
    )
on conflict (course_id, user_id) do update
set status = excluded.status,
    requested_at = excluded.requested_at,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by,
    admin_note = excluded.admin_note;
