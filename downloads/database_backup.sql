--
-- PostgreSQL database dump
--

\restrict d83KrIQp7AV74ka6eM8L5YgdGcZOb4DgkbXgE0jbTmLS3oiX07FrhVNcMIGhfB7

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
-- Name: image_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.image_feedback (
    id integer NOT NULL,
    image_id integer NOT NULL,
    user_id integer,
    user_name text,
    corrected_bird_count integer,
    corrected_health_score integer,
    corrected_risk_level text,
    confidence_rating integer,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.image_feedback OWNER TO postgres;

--
-- Name: image_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.image_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.image_feedback_id_seq OWNER TO postgres;

--
-- Name: image_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.image_feedback_id_seq OWNED BY public.image_feedback.id;


--
-- Name: note_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.note_images (
    id integer NOT NULL,
    note_id integer,
    date text NOT NULL,
    image_url text NOT NULL,
    original_name text,
    mime_type text,
    category text DEFAULT 'general'::text NOT NULL,
    caption text,
    author_id integer,
    author_name text,
    ai_analysis text,
    ai_tags jsonb,
    ai_alerts jsonb,
    ai_confidence integer,
    analysis_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    visual_metrics jsonb,
    risk_score integer
);


ALTER TABLE public.note_images OWNER TO postgres;

--
-- Name: note_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.note_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.note_images_id_seq OWNER TO postgres;

--
-- Name: note_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.note_images_id_seq OWNED BY public.note_images.id;


--
-- Name: prediction_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prediction_logs (
    id integer NOT NULL,
    engine_version text DEFAULT '2.0'::text NOT NULL,
    analysis_type text NOT NULL,
    input_hash text NOT NULL,
    predicted_hatch_rate numeric(6,3),
    predicted_risk_score integer,
    confidence_score integer,
    actual_hatch_rate numeric(6,3),
    actual_risk_materialized text,
    prediction_error numeric(6,3),
    features_snapshot jsonb,
    model_metrics jsonb,
    data_quality_score integer,
    anomalies_detected jsonb,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.prediction_logs OWNER TO postgres;

--
-- Name: prediction_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.prediction_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.prediction_logs_id_seq OWNER TO postgres;

--
-- Name: prediction_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.prediction_logs_id_seq OWNED BY public.prediction_logs.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

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
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    date date NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    quantity numeric(10,2),
    unit text,
    notes text,
    author_id integer,
    author_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


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
-- Name: image_feedback id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_feedback ALTER COLUMN id SET DEFAULT nextval('public.image_feedback_id_seq'::regclass);


--
-- Name: note_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.note_images ALTER COLUMN id SET DEFAULT nextval('public.note_images_id_seq'::regclass);


--
-- Name: prediction_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prediction_logs ALTER COLUMN id SET DEFAULT nextval('public.prediction_logs_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, title, description, category, date, created_at) FROM stdin;
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
\.


--
-- Data for Name: flocks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flocks (id, name, breed, count, age_days, purpose, notes, created_at) FROM stdin;
1	الحضانة الخشبية ١	روس	117	20	meat	دفعة جيدة — عمر ٢٠ يوم	2026-04-15 20:16:57.639056
2	الحضانة الخشبية ٢	روس	10	40	meat	عمر ٤٠ يوم	2026-04-15 20:16:57.639056
3	الدفعة الأخيرة	روس	190	5	meat	آخر دفعة — عمر قريب من يوم	2026-04-15 20:16:57.639056
\.


--
-- Data for Name: goals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goals (id, title, description, target_value, current_value, unit, category, deadline, completed, created_at) FROM stdin;
1	زيادة نسبة التفقيس	الوصول لنسبة تفقيس أعلى من ٨٥٪ في كل دورة	85.00	0.00	%	hatching	2026-07-14	f	2026-04-15 20:17:01.663203
2	زيادة الإنتاج	الوصول لـ ٥٠٠ كتكوت شهرياً	500.00	190.00	كتكوت	production	2026-06-14	f	2026-04-15 20:17:01.663203
3	تقليل استهلاك العلف	تحسين كفاءة استهلاك العلف وتقليل الهدر	20.00	0.00	كغ/يوم	efficiency	2026-08-13	f	2026-04-15 20:17:01.663203
\.


--
-- Data for Name: hatching_cycles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hatching_cycles (id, batch_name, eggs_set, eggs_hatched, start_date, expected_hatch_date, actual_hatch_date, status, temperature, humidity, notes, created_at, set_time, lockdown_date, lockdown_time, lockdown_temperature, lockdown_humidity) FROM stdin;
\.


--
-- Data for Name: image_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.image_feedback (id, image_id, user_id, user_name, corrected_bird_count, corrected_health_score, corrected_risk_level, confidence_rating, notes, created_at) FROM stdin;
\.


--
-- Data for Name: note_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.note_images (id, note_id, date, image_url, original_name, mime_type, category, caption, author_id, author_name, ai_analysis, ai_tags, ai_alerts, ai_confidence, analysis_status, created_at, visual_metrics, risk_score) FROM stdin;
\.


--
-- Data for Name: prediction_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prediction_logs (id, engine_version, analysis_type, input_hash, predicted_hatch_rate, predicted_risk_score, confidence_score, actual_hatch_rate, actual_risk_materialized, prediction_error, features_snapshot, model_metrics, data_quality_score, anomalies_detected, resolved_at, created_at) FROM stdin;
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
Hb6PmY5rS3C-MmqvZ79I5r4oD6EVqKOD	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T22:56:56.590Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-20 22:56:57
IT8sMwPMYfGIWUb08g4Jolb1dv58WK-Z	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T22:57:18.978Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-20 22:57:20
jGAfS93noO0Stsv3-OnxGet0gILErsp1	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T23:39:44.042Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-20 23:39:45
G1th2guhDCMHcqRsIztJ6B7SguPCJPuB	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T14:35:47.329Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-22 21:21:12
sOLOywbEMqv6s8T03Vf3b03D9lG64lby	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T23:15:41.106Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-20 23:15:42
0sI0CNwIiQrtTf17kE3mqDAF9KNNOMte	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T23:16:17.949Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-20 23:16:19
-ga656klBSFQSsGwxknZllMZOhACPdAx	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T23:17:21.397Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-20 23:17:25
474jkZxsdqFF9pcwVwyutkJqtthUOSMA	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T23:18:15.141Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-20 23:18:16
cyGr1YkAFDunXB7ICwGsDUJeaCyW5Kgf	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T01:23:07.803Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 01:23:13
eOY6-WtYA-MPSi3H7uJVsxV6qzAWzu8s	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T02:28:47.409Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 02:29:08
ubJwSfQdpsZNy3EcjZpYoa4Y32rwHBkh	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-21T23:51:39.922Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":5,"role":"admin","name":"نصار"}	2026-04-22 01:04:46
LGEAL3gnChr1vfIC5l-w74YDeOHPBPXJ	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T11:10:49.140Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-22 21:20:14
HyTSWBvGrM4tCu6ZczCnVAT_cbLToCQm	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T00:32:09.566Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 00:32:33
NxCOntkbzZ7dpB2627qn6Y0Z4ZtdAC4K	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T14:47:35.775Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 14:47:36
o99rPfTb-WHKo1LmvpC1MXJMRCiSh0QG	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-21T01:14:09.755Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-21 01:16:27
K-p0uXAz5Edw5awg53gubJWcrnh3qGY2	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T00:33:32.536Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 00:33:56
CPz5uHBjBYbikZJDI9-ODP2De2cOqSlJ	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-21T01:13:50.693Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":5,"role":"admin","name":"نصار"}	2026-04-21 01:17:26
L5EMi9Ll2G5BR9ufTcvvqMNqRjZx--qP	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T14:24:01.575Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 14:56:43
2eqo5s_LJH37qke5qZVEhF590g7czk-N	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T01:18:51.442Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 01:18:59
FRzr0B8cP2sOGRAWbaCtScnUZYNsgphX	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T01:23:57.574Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 01:23:58
ZsDzW_tY2Ejv8-gbI1y5ouMGDikgWz19	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T01:23:50.988Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 01:23:52
yy5vzL3A3-Z2LUlnc9eRgmax7Wx4elEj	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:49:28.772Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:49:29
CHGYF1mkXyUw_VQYauiwwIKeaV7p0zp6	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:01:37.853Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:01:59
UbTiwKJBGlHL9Cjg61QPRyddGr8lzFH5	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T15:31:33.842Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 15:58:22
lryoL4nsAn6ixPSFNEyRCzEdi5thyhYc	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:00:44.161Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:00:51
xBLa2CnnaPsRXFer9HxfiVmNReQvTCUR	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:50:10.881Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:50:11
qOG0ga4FTM29e08kwy4cT7QKjnHoJUue	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:49:34.564Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:49:37
lLB8i73v8_bYfvWDDSCi6ZXNXMje7uTo	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:50:16.091Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:50:17
lFr9gfi8lgI1WuXqUFtpORFybHh-7A4R	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:56:39.212Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:56:41
4HL15v8BAKf0EdMxCLZ1aafQPGShP4au	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:56:48.352Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:56:50
IQsA7LWCsQTVc-P4bg7EAIn9SUgmVCG8	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T16:59:17.378Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 16:59:20
M4TqeQB8wwr6t4pUfll-aEnAgXCPExsa	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:09:48.683Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:09:49
6BXY2JCadKgVnPrhSkyaqrcu8FslodRh	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:10:03.512Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:10:04
mSd83_dZZnrmad9GBfNUgZl42ltCtcA-	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:41:32.001Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:41:33
1wua8m4D0RUvjiz6PRsaTSVqFxrvrpPU	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T20:32:47.304Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 20:32:55
ULM7SLDhowl4_47cr7py42y2joiWFFmF	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:39:44.779Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:39:46
_-jaBT6dlvIobwEyH_3CX8NGwGeH7yQY	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:22:20.539Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:22:41
hTSjRnf4sI2dEt_DmnZkBNuKqrLzJh7l	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:09:02.271Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:09:03
irQU3rgzPsUtq3mCHlSNSsrDquPCbJjO	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:24:57.877Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:25:07
KfKI9GLw2jpSX80nk6jCfmbd9pAzKUG-	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:39:57.389Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:40:05
HaHtOLLGSbE8Y8124I3dYERuVh2U23s-	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-22T17:25:38.431Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"role":"admin","name":"يونس"}	2026-04-22 17:25:39
yGR9Hur8MxdbGn-gkVGVDdaEr56zmYy_	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-20T22:55:46.736Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":4,"role":"admin","name":"رؤوف"}	2026-04-22 18:06:29
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
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, date, type, category, description, amount, quantity, unit, notes, author_id, author_name, created_at) FROM stdin;
1	2026-04-15	expense	other	بيض	30000.00	90.00	\N	تم وضعهم بالمفقسه مباسره وتشغيلها ب ٩٠ بيضه ، 	4	raoof	2026-04-15 20:23:26.031673
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

SELECT pg_catalog.setval('public.activity_logs_id_seq', 1, false);


--
-- Name: daily_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.daily_notes_id_seq', 1, false);


--
-- Name: flocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.flocks_id_seq', 3, true);


--
-- Name: goals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.goals_id_seq', 3, true);


--
-- Name: hatching_cycles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hatching_cycles_id_seq', 1, false);


--
-- Name: image_feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.image_feedback_id_seq', 1, false);


--
-- Name: note_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.note_images_id_seq', 1, false);


--
-- Name: prediction_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.prediction_logs_id_seq', 1, false);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 1, false);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 1, true);


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
-- Name: image_feedback image_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_feedback
    ADD CONSTRAINT image_feedback_pkey PRIMARY KEY (id);


--
-- Name: note_images note_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.note_images
    ADD CONSTRAINT note_images_pkey PRIMARY KEY (id);


--
-- Name: prediction_logs prediction_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prediction_logs
    ADD CONSTRAINT prediction_logs_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


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
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


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
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);


--
-- Name: idx_activity_logs_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_date ON public.activity_logs USING btree (date);


--
-- Name: idx_daily_notes_author_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_notes_author_id ON public.daily_notes USING btree (author_id);


--
-- Name: idx_daily_notes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_notes_created_at ON public.daily_notes USING btree (created_at);


--
-- Name: idx_daily_notes_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_notes_date ON public.daily_notes USING btree (date);


--
-- Name: idx_flocks_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flocks_created_at ON public.flocks USING btree (created_at);


--
-- Name: idx_goals_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_goals_completed ON public.goals USING btree (completed);


--
-- Name: idx_goals_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_goals_created_at ON public.goals USING btree (created_at);


--
-- Name: idx_hatching_cycles_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hatching_cycles_created_at ON public.hatching_cycles USING btree (created_at);


--
-- Name: idx_hatching_cycles_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hatching_cycles_status ON public.hatching_cycles USING btree (status);


--
-- Name: idx_tasks_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_completed ON public.tasks USING btree (completed);


--
-- Name: idx_tasks_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_created_at ON public.tasks USING btree (created_at);


--
-- Name: idx_tasks_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: image_feedback image_feedback_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_feedback
    ADD CONSTRAINT image_feedback_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.note_images(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict d83KrIQp7AV74ka6eM8L5YgdGcZOb4DgkbXgE0jbTmLS3oiX07FrhVNcMIGhfB7

