// Schema migrations, embedded so they ship with the compiled server.
// Applied in order by migrate.ts; each runs once (tracked in schema_migrations).

export const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: '001_init',
    sql: `
-- StayScout initial schema.
--
-- Access control is enforced by the application server: every trip query is
-- scoped by owner_hash (sha256 of an httpOnly cookie token) or by
-- share_token_hash for read-only links. The database is never exposed to
-- browsers directly, so there is no anon role and no RLS policy here. If you
-- later expose these tables through Supabase/PostgREST, enable RLS first.

create table if not exists trips (
  id uuid primary key,
  owner_hash text not null check (length(owner_hash) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accommodation jsonb,
  preferences jsonb,
  itinerary jsonb,
  discovery jsonb,
  share_token_hash text unique check (share_token_hash is null or length(share_token_hash) = 64)
);
create index if not exists trips_owner_idx on trips (owner_hash, updated_at desc);

create table if not exists trip_places (
  trip_id uuid not null references trips (id) on delete cascade,
  place_id text not null,
  provider text not null,
  provider_place_id text not null,
  record jsonb not null,
  selected boolean not null default false,
  favourite boolean not null default false,
  expires_at timestamptz,
  primary key (trip_id, place_id),
  unique (trip_id, provider, provider_place_id)
);
create index if not exists trip_places_expiry_idx on trip_places (expires_at) where expires_at is not null;

create table if not exists orders (
  id uuid primary key,
  trip_id uuid not null references trips (id) on delete cascade,
  provider text not null,
  provider_order_id text not null,
  amount text not null,
  currency char(3) not null,
  status text not null check (status in ('created', 'pending', 'paid', 'failed')),
  capture_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_order_id),
  unique (provider, capture_id)
);
create index if not exists orders_trip_idx on orders (trip_id, status);

create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
`,
  },
  {
    // Keep orders when a trip is deleted (refunds and accounting need the
    // capture id), and allow a 'refunded' status.
    name: '002_keep_orders_add_refunded',
    sql: `
alter table orders alter column trip_id drop not null;
alter table orders drop constraint if exists orders_trip_id_fkey;
alter table orders add constraint orders_trip_id_fkey
  foreign key (trip_id) references trips (id) on delete set null;
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('created', 'pending', 'paid', 'failed', 'refunded'));
create index if not exists orders_capture_idx on orders (provider, capture_id);
`,
  },
]
