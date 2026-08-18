-- Subscription architecture: provider-agnostic, no final pricing hard-coded.
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
create type billing_interval as enum ('monthly', 'annual');

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- e.g. 'family_monthly', 'single_annual'
  name text not null,
  max_learners smallint not null default 1,
  billing_interval billing_interval not null,
  price_cents integer, -- nullable until commercial pricing is finalised; not enforced client-side
  currency text not null default 'ZAR',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  plan_id uuid references subscription_plans(id),
  status subscription_status not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text, -- e.g. 'paystack', 'peach_payments' -- set when a provider is connected
  provider_customer_id text,
  provider_subscription_id text,
  promo_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_parent on subscriptions(parent_id);

-- Moderation: abstraction only. We never store the raw uploaded content longer than needed
-- to process it (storage bucket has its own short retention policy), only the decision.
create type moderation_content_type as enum ('image', 'pdf', 'text');
create type moderation_decision as enum ('approved', 'rejected', 'pending');

create table moderation_logs (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references learners(id) on delete set null,
  parent_id uuid references parents(id) on delete set null,
  content_type moderation_content_type not null,
  decision moderation_decision not null default 'pending',
  reasons jsonb not null default '[]', -- machine reason codes only, never shown to the child verbatim
  provider text not null default 'mock', -- swappable moderation provider name
  created_at timestamptz not null default now()
);

create index idx_moderation_logs_learner on moderation_logs(learner_id);

-- Admin roles. Deliberately separate from `parents` -- an admin is not implicitly a parent
-- and a parent is not implicitly an admin.
create type admin_role as enum ('content_admin', 'super_admin');

create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  role admin_role not null default 'content_admin',
  created_at timestamptz not null default now()
);

create type audit_actor_type as enum ('parent', 'admin', 'system');

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_type audit_actor_type not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_created on audit_logs(created_at desc);

-- Helper: is the current authenticated user an admin? Used throughout RLS policies.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from admins where id = auth.uid());
$$;
