--
-- PostgreSQL database dump
--

\restrict TEkL9WVPpBF3spuMTDVle2hiGegx0tK412QsHn41RpUA5K7tD4jVUXQOtIeFo7l

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'other'::text NOT NULL,
    date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: auth_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auth_users OWNER TO postgres;

--
-- Name: daily_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_notes (
    id integer NOT NULL,
    content text NOT NULL,
    date date NOT NULL,
    author_id integer,
    author_name text,
    category text DEFAULT 'general'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.daily_notes OWNER TO postgres;

--
-- Name: daily_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_notes_id_seq OWNER TO postgres;

--
-- Name: daily_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_notes_id_seq OWNED BY public.daily_notes.id;


--
-- Name: flocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flocks (
    id integer NOT NULL,
    name text NOT NULL,
    breed text NOT NULL,
    count integer NOT NULL,
    age_days integer NOT NULL,
    purpose text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.flocks OWNER TO postgres;

--
-- Name: flocks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.flocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.flocks_id_seq OWNER TO postgres;

--
-- Name: flocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.flocks_id_seq OWNED BY public.flocks.id;


--
-- Name: goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.goals (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    target_value numeric(10,2) NOT NULL,
    current_value numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    unit text NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    deadline date,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.goals OWNER TO postgres;

--
-- Name: goals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.goals_id_seq OWNER TO postgres;

--
-- Name: goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.goals_id_seq OWNED BY public.goals.id;


--
-- Name: hatching_cycles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hatching_cycles (
    id integer NOT NULL,
    batch_name text NOT NULL,
    eggs_set integer NOT NULL,
    eggs_hatched integer,
    start_date date NOT NULL,
    expected_hatch_date date NOT NULL,
    actual_hatch_date date,
    status text DEFAULT 'incubating'::text NOT NULL,
    temperature numeric(5,2),
    humidity numeric(5,2),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    set_time text,
    lockdown_date date,
    lockdown_time text,
    lockdown_temperature numeric(5,2),
    lockdown_humidity numeric(5,2)
);


ALTER TABLE public.hatching_cycles OWNER TO postgres;

--
-- Name: hatching_cycles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hatching_cycles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hatching_cycles_id_seq OWNER TO postgres;

--
-- Name: hatching_cycles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hatching_cycles_id_seq OWNED BY public.hatching_cycles.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'other'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    due_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'worker'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: daily_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_notes ALTER COLUMN id SET DEFAULT nextval('public.daily_notes_id_seq'::regclass);


--
-- Name: flocks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flocks ALTER COLUMN id SET DEFAULT nextval('public.flocks_id_seq'::regclass);


--
-- Name: goals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goals ALTER COLUMN id SET DEFAULT nextval('public.goals_id_seq'::regclass);


--
-- Name: hatching_cycles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hatching_cycles ALTER COLUMN id SET DEFAULT nextval('public.hatching_cycles_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, title, description, category, date, created_at) FROM stdin;
1	بدء الدفعة الثانية للتفقيس	وضعنا 80 بيضة في الحاضنة وضبطنا الحرارة على 37.8 درجة	hatching	2026-04-10	2026-04-10 01:19:39.163831
2	علاج حالة زكام	لاحظنا أعراض زكام على 3 طيور، تم عزلها وإعطاؤها مضاد حيوي	health	2026-04-10	2026-04-10 01:19:39.163831
3	تغذية الصباح	تمت التغذية بشكل طبيعي، استهلاك جيد للعلف	feeding	2026-04-10	2026-04-10 01:19:39.163831
4	بدا الدوام اليوم . عبود 	عبود اتصل عالواتس اب الساعه 12	observation	2026-04-10	2026-04-10 10:11:48.824799
\.


--
-- Data for Name: auth_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auth_users (id, email, first_name, last_name, profile_image_url, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: daily_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_notes (id, content, date, author_id, author_name, category, created_at) FROM stdin;
1	ملاحظة اختبار - هذه ملاحظة تجريبية	2026-04-11	1	المدير	general	2026-04-11 02:47:03.979888
2	ملاحظة اختبار	2026-04-13	5	ناصر	general	2026-04-13 05:26:37.692176
\.


--
-- Data for Name: flocks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flocks (id, name, breed, count, age_days, purpose, notes, created_at) FROM stdin;
5	صيصان الدفعة الأولى	دجاج محلي	17	40	hatching	من أول دورة تفقيس - 60 بيضة فقس منها 17 صوص	2026-04-11 16:04:26.686876
6	صيصان الدفعة الثانية	دجاج محلي	110	25	hatching	من ثاني دورة تفقيس - 207 بيضة فقس منها 110 صوص، الأعداد الحالية 117	2026-04-11 16:04:26.723901
8	قطيع اختبار	بلدي	25	10	eggs	اختبار	2026-04-13 05:26:37.535747
\.


--
-- Data for Name: goals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goals (id, title, description, target_value, current_value, unit, category, deadline, completed, created_at) FROM stdin;
4	نظافة العنابر اليومية	تنظيف يومي منتظم لمدة شهر	30.00	18.00	يوم	health	\N	f	2026-04-10 01:19:35.325271
\.


--
-- Data for Name: hatching_cycles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hatching_cycles (id, batch_name, eggs_set, eggs_hatched, start_date, expected_hatch_date, actual_hatch_date, status, temperature, humidity, notes, created_at, set_time, lockdown_date, lockdown_time, lockdown_temperature, lockdown_humidity) FROM stdin;
8	الدفعة الثالثة	207	150	2026-03-21	2026-04-11	2026-04-11	hatching	37.70	55.00	فتحنا الماكينة اليوم - تقريباً 150 صوص وننتظر الباقي. تم إعطاؤهم ماء وسكر ونقلهم للحاضنات للعناية بهم لأول ساعات ثم للغرفة الخاصة بهم	2026-04-11 16:04:13.407723	08:00	2026-04-08	08:00	34.40	73.00
6	الدفعة الأولى	60	17	2026-02-09	2026-03-02	2026-03-02	completed	37.70	55.00	أول تجربة تفقيس - الحرارة 37.7 والرطوبة 55% لأول 18 يوم، ثم 34.4 والرطوبة 70% لآخر 3 أيام	2026-04-11 16:04:13.003549	08:00	2026-02-27	08:00	34.40	70.00
2	الدفعة الثانية	207	\N	2026-03-20	2026-04-10	\N	completed	37.80	65.00	دفعة جديدة قيد التحضين	2026-04-10 01:19:27.51466	\N	2026-04-29	\N	\N	\N
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, title, description, category, priority, completed, due_date, created_at) FROM stdin;
3	تنظيف العنابر	كنس وتعقيم الأرضية	cleaning	medium	t	2026-04-10	2026-04-10 01:19:31.601472
4	تشميع البيض وتقليبه	تقليب البيض في الحاضنة وفحص نمو الجنين	hatching	high	t	2026-04-11	2026-04-10 01:19:31.601472
1	تغذية القطيع الصباحية	تأكد من توفر الماء والعلف الكافي	feeding	high	t	2026-04-10	2026-04-10 01:19:31.601472
2	فحص درجة حرارة الحاضنة	قياس الحرارة والرطوبة وتسجيلها	hatching	high	f	2026-04-10	2026-04-10 01:19:31.601472
6	مهمة اختبار		feeding	high	t	2026-04-11	2026-04-11 02:45:40.149931
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, name, role, created_at) FROM stdin;
3	yones	$2b$10$//yn/jQ6.MraUx1Rne9kn.bMiZBBWN5cm.jNxndnX.GLMHdj1LQDy	يونس	admin	2026-04-11 03:12:10.513016
4	raoof	$2b$10$NKHRRurKUiWLwEKhq7cO3upQlN7yiDIqJE82Q1HfEX25KqHt/TKWC	رؤوف	admin	2026-04-11 03:12:10.624413
6	hoobi	$2b$10$bD2bu3iI2SQ4MSxWoIu4nO2nG5FxyfermpJYZneaaORCMfaxfL6DK	هوبي	worker	2026-04-11 03:12:10.79429
7	abood	$2b$10$ThzMS3iUlxOVWVbuVSzbIeTkvotjnm2hHiMBAYRcKf4obroDeih/u	عبود	worker	2026-04-11 03:12:10.879098
5	nassar	$2b$10$2hqFTd53MWEdT2.ucQWebubEMT3g3UglqJUH9m5Y25g.4mRvf7fpe	نصار	admin	2026-04-11 03:12:10.711937
\.


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 4, true);


--
-- Name: daily_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.daily_notes_id_seq', 2, true);


--
-- Name: flocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.flocks_id_seq', 8, true);


--
-- Name: goals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.goals_id_seq', 4, true);


--
-- Name: hatching_cycles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hatching_cycles_id_seq', 8, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_users auth_users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_email_unique UNIQUE (email);


--
-- Name: auth_users auth_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_pkey PRIMARY KEY (id);


--
-- Name: daily_notes daily_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_notes
    ADD CONSTRAINT daily_notes_pkey PRIMARY KEY (id);


--
-- Name: flocks flocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flocks
    ADD CONSTRAINT flocks_pkey PRIMARY KEY (id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: hatching_cycles hatching_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hatching_cycles
    ADD CONSTRAINT hatching_cycles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- PostgreSQL database dump complete
--

\unrestrict TEkL9WVPpBF3spuMTDVle2hiGegx0tK412QsHn41RpUA5K7tD4jVUXQOtIeFo7l

