--
-- PostgreSQL database dump
--

\restrict HUZcKDEdnUVxCmRxvXxXghhvtxTVdiUxvPj4uPFCJtlVjwiDYjLVyvV4f6zgLbe

-- Dumped from database version 17.7 (Ubuntu 17.7-0ubuntu0.25.04.1)
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-0ubuntu0.25.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: course_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_enrollments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    admin_note text,
    CONSTRAINT course_enrollments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revoked'::text])))
);


--
-- Name: course_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_sections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_sections_position_check CHECK (("position" > 0))
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    author_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    cover_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT courses_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: lesson_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_progress (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lesson_id uuid NOT NULL,
    user_id uuid NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lesson_quiz_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_quiz_responses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lesson_id uuid NOT NULL,
    user_id uuid NOT NULL,
    quiz_id text NOT NULL,
    selected_option_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_quiz_responses_selected_option_index_check CHECK ((selected_option_index >= 0))
);


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lessons (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    section_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    "position" integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    draft_content jsonb DEFAULT '{"blocks": []}'::jsonb NOT NULL,
    published_content jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT lessons_draft_content_is_object CHECK ((jsonb_typeof(draft_content) = 'object'::text)),
    CONSTRAINT lessons_position_check CHECK (("position" > 0)),
    CONSTRAINT lessons_published_content_is_object CHECK (((published_content IS NULL) OR (jsonb_typeof(published_content) = 'object'::text))),
    CONSTRAINT lessons_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_assets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    course_id uuid,
    lesson_id uuid,
    kind text NOT NULL,
    original_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    storage_key text NOT NULL,
    public_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_assets_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'video'::text, 'pdf'::text, 'file'::text]))),
    CONSTRAINT media_assets_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid,
    course_id uuid,
    enrollment_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    read_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['course_enrollment_requested'::text, 'course_access_approved'::text, 'course_access_rejected'::text, 'course_access_revoked'::text, 'course_access_restored'::text])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT sessions_expires_after_created CHECK ((expires_at > created_at))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    google_sub text,
    email text NOT NULL,
    password text,
    full_name text NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Data for Name: course_enrollments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.course_enrollments (id, course_id, user_id, status, requested_at, reviewed_at, reviewed_by, admin_note) FROM stdin;
12b7a1e0-7136-4ee7-8e01-a49d099443da	10000000-0000-0000-0000-000000000001	40000000-0000-0000-0000-000000000001	pending	2026-06-02 13:47:29.89226+05	\N	\N	\N
f12d0f3f-c0d9-4a30-9250-c93b9cbd792a	10000000-0000-0000-0000-000000000001	40000000-0000-0000-0000-000000000002	pending	2026-06-02 07:47:29.89226+05	\N	\N	\N
3cf01177-083e-424a-a5c0-e25b2381d3fd	10000000-0000-0000-0000-000000000001	40000000-0000-0000-0000-000000000003	pending	2026-06-01 15:47:29.89226+05	\N	\N	\N
ebf0cbe1-0aa5-4252-8a21-8cba415f3338	10000000-0000-0000-0000-000000000001	40000000-0000-0000-0000-000000000004	approved	2026-05-29 15:47:29.89226+05	2026-05-29 19:47:29.89226+05	b1bde103-8558-467c-ada2-c8e5a76a95cf	Approved after manual review.
ae797a2a-c08b-4b7a-83d0-2e2ff578280c	10000000-0000-0000-0000-000000000001	40000000-0000-0000-0000-000000000005	approved	2026-05-27 15:47:29.89226+05	2026-05-27 16:47:29.89226+05	b1bde103-8558-467c-ada2-c8e5a76a95cf	Existing student from the intro webinar.
22a3a147-296b-4e26-a832-3b5c452db29e	10000000-0000-0000-0000-000000000001	40000000-0000-0000-0000-000000000006	rejected	2026-05-26 15:47:29.89226+05	2026-05-26 21:47:29.89226+05	b1bde103-8558-467c-ada2-c8e5a76a95cf	Rejected for duplicate registration details.
c8434130-3621-47ff-bad6-245efa547c0c	10000000-0000-0000-0000-000000000001	40000000-0000-0000-0000-000000000007	revoked	2026-05-21 15:47:29.89226+05	2026-06-01 15:47:29.89226+05	b1bde103-8558-467c-ada2-c8e5a76a95cf	Access revoked by admin request.
5af2dd80-64cc-4b5b-8324-1efdb6b24f72	10000000-0000-0000-0000-000000000001	40000000-0000-0000-0000-000000000008	pending	2026-06-02 15:27:29.89226+05	\N	\N	\N
e49e1ded-d2f3-46dc-9f05-60a9545f3d10	10000000-0000-0000-0000-000000000001	62289d03-a67c-4b96-a5eb-b00dc371b184	approved	2026-06-02 22:26:22.692835+05	2026-06-03 12:51:39.76359+05	b1bde103-8558-467c-ada2-c8e5a76a95cf	\N
\.


--
-- Data for Name: course_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.course_sections (id, course_id, title, "position", created_at, updated_at) FROM stdin;
20000000-0000-0000-0000-000000000001	10000000-0000-0000-0000-000000000001	Introduction	1	2026-05-31 23:36:48.974383+05	2026-05-31 23:36:48.974383+05
20000000-0000-0000-0000-000000000002	10000000-0000-0000-0000-000000000001	Preparing the dough	2	2026-05-31 23:36:48.974383+05	2026-05-31 23:36:48.974383+05
5e6915f0-fb2a-4a60-b695-513aeab64c9e	10000000-0000-0000-0000-000000000001	New section 3	3	2026-06-05 17:18:14.304815+05	2026-06-05 17:18:14.304815+05
a8f26c3c-a4de-4b2e-ae7b-e597b8163314	10000000-0000-0000-0000-000000000001	New section 4	4	2026-06-05 17:40:09.255702+05	2026-06-05 17:40:09.255702+05
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.courses (id, author_id, title, slug, description, status, cover_image_url, created_at, updated_at, published_at) FROM stdin;
10000000-0000-0000-0000-000000000001	b1bde103-8558-467c-ada2-c8e5a76a95cf	Homemade Bagels for Beginners	homemade-bagels-for-beginners	A beginner-friendly course about homemade bagels.	published	\N	2026-05-31 23:36:48.960348+05	2026-06-05 17:05:59.986823+05	2026-06-05 17:05:59.986823+05
\.


--
-- Data for Name: lesson_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lesson_progress (id, lesson_id, user_id, completed_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lesson_quiz_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lesson_quiz_responses (id, lesson_id, user_id, quiz_id, selected_option_index, created_at, updated_at) FROM stdin;
e31a9cd2-ad68-43f2-89d3-a8cf7d8e5a65	4502358b-cdfe-415c-8dd8-d0a75f54dee2	62289d03-a67c-4b96-a5eb-b00dc371b184	d-V5sWRG6X	1	2026-06-03 16:37:05.568633+05	2026-06-03 17:00:12.723431+05
\.


--
-- Data for Name: lessons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lessons (id, course_id, section_id, title, slug, "position", status, draft_content, published_content, created_at, updated_at, published_at) FROM stdin;
552c4903-f764-493e-bff5-0b63cab3b8ed	10000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	New lesson 4	new-lesson-4-1780392859824	3	published	{"blocks": []}	{"blocks": []}	2026-06-02 14:34:19.82967+05	2026-06-05 17:05:59.970514+05	2026-06-02 14:39:39.13916+05
30000000-0000-0000-0000-000000000003	10000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	Tools & ingredients	tools-and-ingredients	4	published	{"blocks": [{"data": {"text": "Tools and ingredients for the course."}, "type": "paragraph"}]}	{"blocks": [{"data": {"text": "Tools and ingredients for the course."}, "type": "paragraph"}]}	2026-05-31 23:36:48.992279+05	2026-06-05 17:05:59.974571+05	2026-06-02 14:39:39.144813+05
30000000-0000-0000-0000-000000000004	10000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000002	Bagel dough 101	bagel-dough-101	1	published	{"blocks": [{"data": {"text": "The basics of bagel dough."}, "type": "paragraph"}]}	{"blocks": [{"data": {"text": "The basics of bagel dough."}, "type": "paragraph"}]}	2026-05-31 23:36:48.992279+05	2026-06-05 17:05:59.978539+05	2026-06-02 14:39:39.150259+05
30000000-0000-0000-0000-000000000002	10000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	What makes a bagel a bagel?	what-makes-a-bagel-a-bagel	2	published	{"time": 1780661742419, "blocks": [{"id": "WxwGgAeawL", "data": {"url": "https://iframe.mediadelivery.net/embed/673250/0b8adbd2-d6f1-458b-8637-072beb243968", "name": "Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4", "progress": 100, "uploading": false, "processing": false}, "type": "videoUrl"}, {"id": "_GyvEz64KG", "data": {"text": "A short introduction to bagel texture, shape, and boiling."}, "type": "paragraph"}], "version": "2.31.6"}	{"time": 1780661159936, "blocks": [{"id": "WxwGgAeawL", "data": {"url": "https://iframe.mediadelivery.net/embed/673250/0b8adbd2-d6f1-458b-8637-072beb243968", "name": "Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4", "progress": 100, "uploading": false, "processing": false}, "type": "videoUrl"}, {"id": "_GyvEz64KG", "data": {"text": "A short introduction to bagel texture, shape, and boiling."}, "type": "paragraph"}], "version": "2.31.6"}	2026-05-31 23:36:48.992279+05	2026-06-05 17:15:42.433987+05	2026-06-02 14:39:39.133421+05
4502358b-cdfe-415c-8dd8-d0a75f54dee2	10000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000002	yet another lesson	yet-another-lesson-1780477510929	2	published	{"time": 1780484974242, "blocks": [{"id": "Au5TSUz3aK", "data": {"text": "just came here to flex ok?"}, "type": "paragraph"}, {"id": "L8Lai8IOTM", "data": {"text": "or not"}, "type": "paragraph"}, {"id": "d-V5sWRG6X", "data": {"options": ["Быстро", "Медленно"], "question": "Почему дни летят"}, "type": "quiz"}], "version": "2.31.6"}	{"time": 1780484974242, "blocks": [{"id": "Au5TSUz3aK", "data": {"text": "just came here to flex ok?"}, "type": "paragraph"}, {"id": "L8Lai8IOTM", "data": {"text": "or not"}, "type": "paragraph"}, {"id": "d-V5sWRG6X", "data": {"options": ["Быстро", "Медленно"], "question": "Почему дни летят"}, "type": "quiz"}], "version": "2.31.6"}	2026-06-03 14:05:02.87092+05	2026-06-05 17:05:59.982505+05	2026-06-03 14:05:24.006981+05
78d1cd03-f771-4b36-8a96-e66865cc1ae0	10000000-0000-0000-0000-000000000001	5e6915f0-fb2a-4a60-b695-513aeab64c9e	placeholder 1	placeholder-1-1780663193699	1	draft	{"blocks": []}	\N	2026-06-05 17:39:46.129185+05	2026-06-05 17:39:53.713655+05	\N
ab251b72-ca9f-4487-a0c7-66c679fd1753	10000000-0000-0000-0000-000000000001	5e6915f0-fb2a-4a60-b695-513aeab64c9e	placeholde1	placeholde1-1780663199031	2	draft	{"blocks": []}	\N	2026-06-05 17:39:54.430859+05	2026-06-05 17:39:59.047114+05	\N
30000000-0000-0000-0000-000000000001	10000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	Добро пожаловать на курс!	lesson-1780393766820	1	published	{"time": 1780647278666, "blocks": [{"id": "FTcHPzNhV1", "data": {"text": "Welcome to the course!"}, "type": "paragraph"}, {"id": "EqVjf7jx7k", "data": {"url": "https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/dc1a0686-8dbc-40fc-8f31-e6a7f71168fd.png", "width": 35, "caption": "image.png", "uploading": false}, "type": "imageUrl"}, {"id": "kDFTv3O6sG", "data": {"text": "insane course stuff"}, "type": "paragraph"}], "version": "2.31.6"}	{"time": 1780647278666, "blocks": [{"id": "FTcHPzNhV1", "data": {"text": "Welcome to the course!"}, "type": "paragraph"}, {"id": "EqVjf7jx7k", "data": {"url": "https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/dc1a0686-8dbc-40fc-8f31-e6a7f71168fd.png", "width": 35, "caption": "image.png", "uploading": false}, "type": "imageUrl"}, {"id": "kDFTv3O6sG", "data": {"text": "insane course stuff"}, "type": "paragraph"}], "version": "2.31.6"}	2026-05-31 23:36:48.992279+05	2026-06-05 17:05:59.951658+05	2026-06-02 14:39:39.11982+05
3cffb6cd-a8cb-434a-9108-3218570c7085	10000000-0000-0000-0000-000000000001	5e6915f0-fb2a-4a60-b695-513aeab64c9e	placeholder1	placeholder1-1780663205434	3	draft	{"blocks": []}	\N	2026-06-05 17:40:00.793298+05	2026-06-05 17:40:05.449862+05	\N
2addf65e-1a07-4970-9236-237c5479a5d4	10000000-0000-0000-0000-000000000001	a8f26c3c-a4de-4b2e-ae7b-e597b8163314	placeholder 2	placeholder-2-1780663218043	1	draft	{"blocks": []}	\N	2026-06-05 17:40:11.455687+05	2026-06-05 17:40:18.05844+05	\N
\.


--
-- Data for Name: media_assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.media_assets (id, owner_id, course_id, lesson_id, kind, original_name, mime_type, size_bytes, storage_key, public_url, created_at) FROM stdin;
90e6694f-ec58-4c03-bd06-bebb1dbf9f6a	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	loss.png	image/png	46539	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/11f3065e-966a-406c-94ab-f1225fb5b66a.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/11f3065e-966a-406c-94ab-f1225fb5b66a.png	2026-06-01 21:02:42.404162+05
acdb032e-979a-46e4-87d8-d230af73a1cd	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	loss.png	image/png	46539	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/43ceca34-b281-4843-8d7c-18602c7bcdc4.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/43ceca34-b281-4843-8d7c-18602c7bcdc4.png	2026-06-01 21:09:07.059552+05
c229edad-7ccf-45c2-a247-5b5363bb5761	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	unnamed.webp	image/webp	23080	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/c4164b2b-9035-4be7-a49c-101e75a55acf.webp	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/c4164b2b-9035-4be7-a49c-101e75a55acf.webp	2026-06-01 22:19:40.221569+05
a18acb76-1fbc-4cb2-ada1-7b9fffeefaf2	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	Screenshot From 2026-05-16 17-47-07.png	image/png	9426	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/2b6bb964-50c0-42be-95c7-106f2a091588.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/2b6bb964-50c0-42be-95c7-106f2a091588.png	2026-06-01 22:23:16.397766+05
482a9855-3f70-4ce2-925b-3a18dbbc0416	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	Screenshot From 2026-05-16 18-28-32.png	image/png	28882	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/e6654ab4-80e4-4fe9-80a1-3071ddb0ca79.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/e6654ab4-80e4-4fe9-80a1-3071ddb0ca79.png	2026-06-01 22:29:44.288619+05
3ecfcb3a-f6fc-4f93-a116-909c8ebb25b6	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	Screenshot From 2026-05-16 18-39-46.png	image/png	33698	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/cc806fb4-51f7-41b5-9aa6-b34bf8e0c457.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/cc806fb4-51f7-41b5-9aa6-b34bf8e0c457.png	2026-06-01 22:33:17.358085+05
66c27981-923b-468b-9d61-ee95996d51db	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	Screenshot From 2026-05-17 06-05-29.png	image/png	72382	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/e75cfaad-8f12-432d-be5f-f25244ea23e1.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/e75cfaad-8f12-432d-be5f-f25244ea23e1.png	2026-06-01 22:35:44.223784+05
18b5f73e-2333-4011-9272-4dc40d5c368e	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	Screenshot From 2026-05-16 18-47-51.png	image/png	9492	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/6a4faf3a-ffa2-4524-83e3-cba1d70aa0c1.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/6a4faf3a-ffa2-4524-83e3-cba1d70aa0c1.png	2026-06-01 22:37:59.082348+05
6c768b71-4790-4e1d-bacd-2ffd88a97c84	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	pdf	KZ076017191000004317.pdf	application/pdf	58115	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/pdfs/2e916155-33a1-4648-8fd2-d10bd5a5c3b9.pdf	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/pdfs/2e916155-33a1-4648-8fd2-d10bd5a5c3b9.pdf	2026-06-01 22:39:16.701715+05
fc9d6d9a-9ba1-438d-aab5-a813f7b1ae33	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	vote-qr.png	image/png	770	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/1e6862cb-b535-4b59-a0d7-abe476eee37d.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/1e6862cb-b535-4b59-a0d7-abe476eee37d.png	2026-06-01 22:44:57.076915+05
948fea37-be58-48af-9add-fb4c994634f3	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	pdf	KZ076017191000004317.pdf	application/pdf	58115	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/pdfs/55063ce1-5396-4b00-a8eb-7865b393efe1.pdf	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/pdfs/55063ce1-5396-4b00-a8eb-7865b393efe1.pdf	2026-06-01 22:45:30.663926+05
50fe7083-14b2-4ddf-8501-805657cf9fe8	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	video	Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4	video/*	8529742	bunny-stream/673250/e2f054a5-c001-4667-b3f1-548fff957626	https://iframe.mediadelivery.net/embed/673250/e2f054a5-c001-4667-b3f1-548fff957626	2026-06-01 22:46:06.92367+05
a9d8b112-c1d0-41a6-bc0a-9a84ab354a85	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	video	Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4	video/*	8529742	bunny-stream/673250/edd090c0-aff1-42f4-bec0-6429c90b83c5	https://iframe.mediadelivery.net/embed/673250/edd090c0-aff1-42f4-bec0-6429c90b83c5	2026-06-01 22:49:45.918296+05
312c2a21-183e-4865-9914-8a552f51f36b	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	video	Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4	video/*	8529742	bunny-stream/673250/f375d2fa-e0dc-41e4-8e3d-648360bbbf16	https://iframe.mediadelivery.net/embed/673250/f375d2fa-e0dc-41e4-8e3d-648360bbbf16	2026-06-01 23:02:35.39812+05
ef6c0bb9-1549-4f58-8375-fd28969edead	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	video	Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4	video/*	8529742	bunny-stream/673250/e6cc8014-4bb9-4d05-8f7d-063f3ae4d1ca	https://iframe.mediadelivery.net/embed/673250/e6cc8014-4bb9-4d05-8f7d-063f3ae4d1ca	2026-06-01 23:06:59.337456+05
d83cd34b-ae5a-42a2-84fc-67429c60d6f1	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	image	image.png	image/png	2400405	courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/dc1a0686-8dbc-40fc-8f31-e6a7f71168fd.png	https://logos-voice.b-cdn.net/courses/10000000-0000-0000-0000-000000000001/lessons/30000000-0000-0000-0000-000000000001/images/dc1a0686-8dbc-40fc-8f31-e6a7f71168fd.png	2026-06-02 15:10:03.024409+05
97de7e07-95a6-4bd4-aa4b-93c79d510c36	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000002	video	Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4	video/*	8529742	bunny-stream/673250/76b23d16-d110-4ae1-94a5-473b91317ae1	https://iframe.mediadelivery.net/embed/673250/76b23d16-d110-4ae1-94a5-473b91317ae1	2026-06-05 14:29:46.810436+05
2b2c98dd-8890-40eb-9888-6ebae9acb783	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000002	video	Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4	video/*	8529742	bunny-stream/673250/dafb6268-8e4e-4620-82eb-3724c44f6743	https://iframe.mediadelivery.net/embed/673250/dafb6268-8e4e-4620-82eb-3724c44f6743	2026-06-05 14:31:36.527517+05
55dd7426-252d-482b-89e6-882bd17884eb	b1bde103-8558-467c-ada2-c8e5a76a95cf	10000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000002	video	Here’s to the Crazy Ones - Reticulating Splines (720p, h264).mp4	video/*	8529742	bunny-stream/673250/0b8adbd2-d6f1-458b-8637-072beb243968	https://iframe.mediadelivery.net/embed/673250/0b8adbd2-d6f1-458b-8637-072beb243968	2026-06-05 17:05:19.786903+05
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, actor_id, course_id, enrollment_id, type, title, body, read_at, deleted_at, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, created_at, expires_at, revoked_at) FROM stdin;
7c2b550b-993d-4ecd-a31f-c7c130b4a9b1	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-30 15:55:29.80714+05	2026-08-28 15:55:29.806928+05	\N
ad6b48a8-8cc0-4461-9e04-8012d8fd960b	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-30 15:56:27.78571+05	2026-08-28 15:56:27.78508+05	\N
a5317e38-aa33-47ec-a5de-16c59ce16c26	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 08:11:06.164243+05	2026-08-29 08:11:06.163068+05	\N
6177344d-9eee-4816-ba9e-d04db0b20dc4	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 11:05:17.850243+05	2026-08-29 11:05:17.850042+05	\N
2f62d9ad-d72a-4948-830c-d79c76517fb3	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 11:05:19.947367+05	2026-08-29 11:05:19.947133+05	\N
5027e07d-69ef-451e-a01a-fcba032498ec	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 11:05:20.683015+05	2026-08-29 11:05:20.682792+05	\N
c1210146-9019-4066-b7b7-0b55927229a2	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 11:05:20.859617+05	2026-08-29 11:05:20.859353+05	\N
0b7b0773-c794-4143-a920-9c4eb81c4a8b	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 21:15:27.223651+05	2026-08-29 21:15:27.223421+05	\N
28728190-e6f4-49be-9695-bcd25bdd0eda	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 21:15:28.201199+05	2026-08-29 21:15:28.200966+05	\N
f3460a21-9b35-45e6-8f08-f45d3c15c10d	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 21:15:28.421215+05	2026-08-29 21:15:28.420951+05	\N
300ee803-02fa-4bcd-bd8e-6d544265dff4	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 21:15:36.890155+05	2026-08-29 21:15:36.889933+05	\N
f9eed2c7-5484-4b2e-b881-239d5d58cf9c	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-05-31 21:15:43.820153+05	2026-08-29 21:15:43.819923+05	2026-06-02 16:58:16.796993+05
c50bf1ab-2866-4de1-b1fd-462ea62a3368	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-06-02 18:31:26.782979+05	2026-08-31 18:31:26.782241+05	2026-06-02 18:32:29.844577+05
b48687f4-a065-47a1-a50c-cb9c70746413	62289d03-a67c-4b96-a5eb-b00dc371b184	2026-06-02 22:22:38.878269+05	2026-08-31 22:22:38.877697+05	2026-06-02 22:25:46.002293+05
6f3aee9b-cbc0-4c0d-9e06-169baa1d5a1a	62289d03-a67c-4b96-a5eb-b00dc371b184	2026-06-02 22:26:16.106844+05	2026-08-31 22:26:16.106607+05	2026-06-03 12:51:06.063483+05
a9dee09e-1753-4487-aaa9-3b8a41356922	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-06-03 12:51:26.743147+05	2026-09-01 12:51:26.742608+05	2026-06-03 12:51:48.096869+05
384037bd-7daf-4497-9008-adc7dddd619e	62289d03-a67c-4b96-a5eb-b00dc371b184	2026-06-03 12:51:59.665086+05	2026-09-01 12:51:59.664719+05	2026-06-03 13:58:27.311267+05
230ca366-b0bc-4e4e-8c66-4fbdd1e804c3	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-06-03 13:58:56.934567+05	2026-09-01 13:58:56.933929+05	2026-06-03 16:36:33.84238+05
9859b456-d2ef-492a-bbf9-1fafedeedb53	62289d03-a67c-4b96-a5eb-b00dc371b184	2026-06-03 16:36:45.691103+05	2026-09-01 16:36:45.690489+05	2026-06-03 17:00:20.264023+05
7c1d2e24-faf9-4616-bfaf-21b9487eb671	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-06-03 17:00:31.866193+05	2026-09-01 17:00:31.865656+05	2026-06-05 17:41:15.730921+05
e5efd718-010b-4830-a1cc-a2eaef24a53d	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-06-06 16:12:12.780358+05	2026-09-04 16:12:12.77997+05	2026-06-06 16:27:14.376077+05
9b3cb095-e07e-4e1e-a7c3-411848105724	62289d03-a67c-4b96-a5eb-b00dc371b184	2026-06-06 16:27:23.228841+05	2026-09-04 16:27:23.228407+05	2026-06-06 16:27:31.674692+05
c18b97ae-25a9-47cb-8286-9760ba2651a7	62289d03-a67c-4b96-a5eb-b00dc371b184	2026-06-06 16:27:38.515746+05	2026-09-04 16:27:38.515638+05	\N
46c42a32-0850-4af9-acc4-3a7946ee08d3	b1bde103-8558-467c-ada2-c8e5a76a95cf	2026-06-11 18:12:05.145696+05	2026-09-09 18:12:05.144939+05	2026-06-11 18:15:58.71519+05
c901cd45-24bf-448f-92ea-9febeb720395	62289d03-a67c-4b96-a5eb-b00dc371b184	2026-06-11 18:19:06.000757+05	2026-09-09 18:19:06.000112+05	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, google_sub, email, password, full_name, role, created_at) FROM stdin;
b1bde103-8558-467c-ada2-c8e5a76a95cf	115911650946997509007	satanov201354@gmail.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Maxim	admin	2026-05-30 15:55:29.804341+05
40000000-0000-0000-0000-000000000001	\N	aigerim.nurlybekova@example.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Aigerim Nurlybekova	member	2026-06-02 15:47:29.867555+05
40000000-0000-0000-0000-000000000002	\N	daniyar.sadykov@example.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Daniyar Sadykov	member	2026-06-02 15:47:29.867555+05
40000000-0000-0000-0000-000000000003	\N	aliya.kasenova@example.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Aliya Kasenova	member	2026-06-02 15:47:29.867555+05
40000000-0000-0000-0000-000000000004	\N	timur.valikhanov@example.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Timur Valikhanov	member	2026-06-02 15:47:29.867555+05
40000000-0000-0000-0000-000000000005	\N	madina.ermekova@example.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Madina Ermekova	member	2026-06-02 15:47:29.867555+05
40000000-0000-0000-0000-000000000006	\N	arsen.bekzhan@example.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Arsen Bekzhan	member	2026-06-02 15:47:29.867555+05
40000000-0000-0000-0000-000000000007	\N	zhanar.murat@example.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Zhanar Murat	member	2026-06-02 15:47:29.867555+05
40000000-0000-0000-0000-000000000008	\N	eldar.rakhimov@example.com	$2a$10$hy3rgn5/ZxyrCbGRmjwlKudEVf1S2WIP./RSmX1O6/40IhkL6dKuS	Eldar Rakhimov	member	2026-06-02 15:47:29.867555+05
62289d03-a67c-4b96-a5eb-b00dc371b184	102959840419664843839	satanov.mr@gmail.com	\N	Maxim Satanov	member	2026-06-02 22:22:38.872563+05
\.


--
-- Name: course_enrollments course_enrollments_course_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_course_id_user_id_key UNIQUE (course_id, user_id);


--
-- Name: course_enrollments course_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_pkey PRIMARY KEY (id);


--
-- Name: course_sections course_sections_course_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_sections
    ADD CONSTRAINT course_sections_course_id_position_key UNIQUE (course_id, "position");


--
-- Name: course_sections course_sections_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_sections
    ADD CONSTRAINT course_sections_id_course_id_key UNIQUE (id, course_id);


--
-- Name: course_sections course_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_sections
    ADD CONSTRAINT course_sections_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: courses courses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_slug_key UNIQUE (slug);


--
-- Name: lesson_progress lesson_progress_lesson_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_lesson_id_user_id_key UNIQUE (lesson_id, user_id);


--
-- Name: lesson_progress lesson_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_pkey PRIMARY KEY (id);


--
-- Name: lesson_quiz_responses lesson_quiz_responses_lesson_id_user_id_quiz_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_quiz_responses
    ADD CONSTRAINT lesson_quiz_responses_lesson_id_user_id_quiz_id_key UNIQUE (lesson_id, user_id, quiz_id);


--
-- Name: lesson_quiz_responses lesson_quiz_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_quiz_responses
    ADD CONSTRAINT lesson_quiz_responses_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_course_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_course_id_slug_key UNIQUE (course_id, slug);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_section_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_section_id_position_key UNIQUE (section_id, "position");


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_storage_key_key UNIQUE (storage_key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_sub_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: course_enrollments_course_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_enrollments_course_id_status_idx ON public.course_enrollments USING btree (course_id, status);


--
-- Name: course_enrollments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_enrollments_user_id_idx ON public.course_enrollments USING btree (user_id);


--
-- Name: course_sections_course_id_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_sections_course_id_position_idx ON public.course_sections USING btree (course_id, "position");


--
-- Name: lesson_progress_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_progress_user_id_idx ON public.lesson_progress USING btree (user_id);


--
-- Name: lesson_quiz_responses_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_quiz_responses_user_id_idx ON public.lesson_quiz_responses USING btree (user_id);


--
-- Name: lessons_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lessons_course_id_idx ON public.lessons USING btree (course_id);


--
-- Name: lessons_section_id_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lessons_section_id_position_idx ON public.lessons USING btree (section_id, "position");


--
-- Name: media_assets_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assets_course_id_idx ON public.media_assets USING btree (course_id);


--
-- Name: media_assets_lesson_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assets_lesson_id_idx ON public.media_assets USING btree (lesson_id);


--
-- Name: notifications_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: notifications_user_id_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_unread_idx ON public.notifications USING btree (user_id) WHERE ((read_at IS NULL) AND (deleted_at IS NULL));


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: course_enrollments course_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_enrollments course_enrollments_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: course_enrollments course_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: course_sections course_sections_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_sections
    ADD CONSTRAINT course_sections_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: courses courses_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: lesson_progress lesson_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: lesson_progress lesson_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lesson_quiz_responses lesson_quiz_responses_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_quiz_responses
    ADD CONSTRAINT lesson_quiz_responses_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: lesson_quiz_responses lesson_quiz_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_quiz_responses
    ADD CONSTRAINT lesson_quiz_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_section_id_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_section_id_course_id_fkey FOREIGN KEY (section_id, course_id) REFERENCES public.course_sections(id, course_id) ON DELETE CASCADE;


--
-- Name: media_assets media_assets_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: media_assets media_assets_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: media_assets media_assets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.course_enrollments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict HUZcKDEdnUVxCmRxvXxXghhvtxTVdiUxvPj4uPFCJtlVjwiDYjLVyvV4f6zgLbe

