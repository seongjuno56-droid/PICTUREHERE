-- 픽처히어 어드민용 스키마: 매장 관리 / 고객센터(문의) 관리 / 로그 관리 / 관리자 계정

create table if not exists stores (
  id bigserial primary key,
  bizes_id text unique,
  name text not null,
  branch_name text,
  category_name text,
  type text not null default 'booth' check (type in ('booth', 'studio')),
  road_address text,
  lot_address text,
  lat double precision not null,
  lon double precision not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- stores 테이블이 이미 있던 환경에서도 안전하게 재실행 가능하도록
-- CREATE TABLE 블록이 아니라 ALTER TABLE로 추가 컬럼을 올린다
-- (CREATE TABLE IF NOT EXISTS는 기존 테이블에 컬럼을 추가해주지 않음).
alter table stores add column if not exists brand text; -- 포토부스 프랜차이즈 브랜드명(lib/photoBoothBrands.js 매칭). 사진관은 항상 null → UI에서 "-" 표시
alter table stores add column if not exists ctprvn_name text; -- 시/도
alter table stores add column if not exists signgu_name text; -- 시/군/구

create index if not exists idx_stores_type on stores (type);
create index if not exists idx_stores_created_at on stores (created_at desc);
create index if not exists idx_stores_lat_lon on stores (lat, lon);
create index if not exists idx_stores_brand on stores (brand);
create index if not exists idx_stores_ctprvn on stores (ctprvn_name);
create index if not exists idx_stores_signgu on stores (signgu_name);

create table if not exists inquiries (
  id bigserial primary key,
  name text not null,
  email text,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inquiries_created_at on inquiries (created_at desc);
create index if not exists idx_inquiries_status on inquiries (status);

create table if not exists admin_users (
  id bigserial primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists access_logs (
  id bigserial primary key,
  kind text not null check (kind in ('page', 'api')),
  path text not null,
  method text,
  status_code int,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_logs_created_at on access_logs (created_at desc);
create index if not exists idx_access_logs_kind on access_logs (kind);
