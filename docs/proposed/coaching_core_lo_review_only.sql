-- REVIEW ONLY. Do not execute against production. Pilot LO/evidence contract proposal.
-- Requires isolated schema/RLS tests and academic approval of four LO definitions.
-- Does not replace existing coaching tables or the separate generic module engine proposal.

create table public.coaching_learning_outcomes (
  id text not null,
  version integer not null check (version > 0),
  statement text not null,
  success_criteria text not null,
  active boolean not null default true,
  primary key (id, version)
);

create table public.coaching_enrollment_outcomes (
  enrollment_id uuid not null references public.coaching_enrollments(id),
  outcome_id text not null,
  outcome_version integer not null,
  priority integer not null check (priority > 0),
  rationale text not null,
  checkpoint_on date,
  primary key (enrollment_id, outcome_id, outcome_version),
  foreign key (outcome_id, outcome_version) references public.coaching_learning_outcomes(id, version)
);

create table public.coaching_task_outcomes (
  task_id uuid not null references public.coaching_tasks(id),
  outcome_id text not null,
  outcome_version integer not null,
  evidence_expected text not null,
  primary key (task_id, outcome_id, outcome_version),
  foreign key (outcome_id, outcome_version) references public.coaching_learning_outcomes(id, version)
);

create table public.coaching_outcome_evidence (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.coaching_enrollments(id),
  outcome_id text not null,
  outcome_version integer not null,
  source_type text not null check (source_type in ('task_submission','module_attempt','live_session_note')),
  source_id uuid not null,
  summary text not null,
  captured_at timestamptz not null default now(),
  foreign key (outcome_id, outcome_version) references public.coaching_learning_outcomes(id, version)
  -- TODO: source-type-specific FK validation in a privileged, narrowly checked RPC.
);

create table public.coaching_outcome_assessments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.coaching_enrollments(id),
  outcome_id text not null,
  outcome_version integer not null,
  status text not null check (status in ('not_assessed','emerging','developing','demonstrated','needs_recheck')),
  rationale text not null,
  assessed_by uuid not null references public.profiles(id),
  assessed_at timestamptz not null default now(),
  foreign key (outcome_id, outcome_version) references public.coaching_learning_outcomes(id, version)
  -- TODO: append-only assessment-to-evidence join and assigned-coach RPC.
);

create table public.coaching_work_logs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.coaching_enrollments(id),
  coach_id uuid not null references public.profiles(id),
  work_type text not null check (work_type in ('planning','review','live_session','follow_up')),
  minutes integer not null check (minutes between 1 and 480),
  occurred_on date not null,
  note text
);

-- Deliberately no grants or policies here: this file is incomplete and MUST NOT be applied.
-- Before any migration: define all RLS, least-privilege grants, immutable review history,
-- source ownership validation, and adversarial role tests in an isolated database.
