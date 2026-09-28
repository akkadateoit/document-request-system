-- Database schema for the document request system.
-- Generated with `pg_dump --schema-only` from the production database (PostgreSQL 17) on 2026-09-28,
-- so it matches what the running code expects. Load it into an empty database, then load seed.sql:
--   psql -d <db> -v ON_ERROR_STOP=1 -f database/schema.sql
--   psql -d <db> -v ON_ERROR_STOP=1 -f database/seed.sql
--   node scripts/create-admin.js <username> <password> "<full name>" <email>
--
--

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it

--
-- Name: document_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_request_items (
    id integer NOT NULL,
    request_id integer,
    document_type_id integer,
    quantity integer DEFAULT 1 NOT NULL,
    price_per_unit numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE document_request_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_request_items IS 'เก็บรายละเอียดรายการเอกสารในคำขอแต่ละรายการ';

--
-- Name: COLUMN document_request_items.request_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_request_items.request_id IS 'รหัสอ้างอิงคำขอหลัก';

--
-- Name: COLUMN document_request_items.document_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_request_items.document_type_id IS 'รหัสประเภทเอกสาร';

--
-- Name: COLUMN document_request_items.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_request_items.quantity IS 'จำนวนเอกสาร';

--
-- Name: COLUMN document_request_items.price_per_unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_request_items.price_per_unit IS 'ราคาต่อฉบับ';

--
-- Name: COLUMN document_request_items.subtotal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_request_items.subtotal IS 'ราคารวมของรายการนี้';

--
-- Name: document_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_request_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: document_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_request_items_id_seq OWNED BY public.document_request_items.id;

--
-- Name: document_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_requests (
    id integer NOT NULL,
    user_id integer,
    document_type_id integer,
    delivery_method character varying(50) NOT NULL,
    address text,
    urgent boolean DEFAULT false,
    total_price numeric(10,2) NOT NULL,
    payment_slip_url character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    has_multiple_items boolean DEFAULT false
);

--
-- Name: COLUMN document_requests.delivery_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_requests.delivery_method IS 'วิธีการรับเอกสาร: pickup (รับด้วยตนเอง), pickup_rangsit (รับด้วยตนเอง แผนกทะเบียน รังสิต), mail (รับทางไปรษณีย์)';

--
-- Name: document_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: document_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_requests_id_seq OWNED BY public.document_requests.id;

--
-- Name: document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_types (
    id integer NOT NULL,
    name_th character varying(100) NOT NULL,
    name_en character varying(100) NOT NULL,
    name_zh character varying(100) NOT NULL,
    price numeric(10,2) NOT NULL
);

--
-- Name: document_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: document_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_types_id_seq OWNED BY public.document_types.id;

--
-- Name: faculties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculties (
    id integer NOT NULL,
    name_th character varying(100) NOT NULL,
    name_en character varying(100) NOT NULL,
    name_zh character varying(100) NOT NULL
);

--
-- Name: faculties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.faculties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: faculties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.faculties_id_seq OWNED BY public.faculties.id;

--
-- Name: status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_history (
    id integer NOT NULL,
    request_id integer,
    status character varying(50) NOT NULL,
    note text,
    created_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.status_history_id_seq OWNED BY public.status_history.id;

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    student_id character varying(20) NOT NULL,
    password character varying(100) NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    faculty character varying(100) NOT NULL,
    role character varying(20) DEFAULT 'student'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    birth_date date,
    id_number character varying(20),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: COLUMN users.birth_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.birth_date IS 'วันเดือนปีเกิด';

--
-- Name: COLUMN users.id_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id_number IS 'หมายเลขบัตรประชาชนหรือ Passport';

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Name: document_request_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_request_items ALTER COLUMN id SET DEFAULT nextval('public.document_request_items_id_seq'::regclass);

--
-- Name: document_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_requests ALTER COLUMN id SET DEFAULT nextval('public.document_requests_id_seq'::regclass);

--
-- Name: document_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types ALTER COLUMN id SET DEFAULT nextval('public.document_types_id_seq'::regclass);

--
-- Name: faculties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculties ALTER COLUMN id SET DEFAULT nextval('public.faculties_id_seq'::regclass);

--
-- Name: status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_history ALTER COLUMN id SET DEFAULT nextval('public.status_history_id_seq'::regclass);

--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- Name: document_request_items document_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_request_items
    ADD CONSTRAINT document_request_items_pkey PRIMARY KEY (id);

--
-- Name: document_requests document_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_requests
    ADD CONSTRAINT document_requests_pkey PRIMARY KEY (id);

--
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);

--
-- Name: faculties faculties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculties
    ADD CONSTRAINT faculties_pkey PRIMARY KEY (id);

--
-- Name: status_history status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_history
    ADD CONSTRAINT status_history_pkey PRIMARY KEY (id);

--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: users users_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_student_id_key UNIQUE (student_id);

--
-- Name: idx_document_request_items_document_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_request_items_document_type_id ON public.document_request_items USING btree (document_type_id);

--
-- Name: idx_document_request_items_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_request_items_request_id ON public.document_request_items USING btree (request_id);

--
-- Name: idx_status_history_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_history_request_id ON public.status_history USING btree (request_id);

--
-- Name: idx_users_id_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_id_number ON public.users USING btree (id_number) WHERE (id_number IS NOT NULL);

--
-- Name: document_request_items document_request_items_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_request_items
    ADD CONSTRAINT document_request_items_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id);

--
-- Name: document_request_items document_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_request_items
    ADD CONSTRAINT document_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.document_requests(id) ON DELETE CASCADE;

--
-- Name: document_requests document_requests_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_requests
    ADD CONSTRAINT document_requests_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id);

--
-- Name: document_requests document_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_requests
    ADD CONSTRAINT document_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: status_history status_history_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_history
    ADD CONSTRAINT status_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- Name: status_history status_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_history
    ADD CONSTRAINT status_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.document_requests(id) ON DELETE CASCADE;

--
--

