create extension if not exists "uuid-ossp";

create table if not exists workflows (
    id uuid primary key default uuid_generate_v4(),
    prompt_text text not null,
    status text not null default 'pending', -- pending | searching | crawling | extracting | completed | failed
    schema_definition jsonb,                -- the dynamic list of fields the AI decided to extract
    error_message text,
    created_at timestamptz not null default now()
);

create table if not exists extracted_data (
    id uuid primary key default uuid_generate_v4(),
    workflow_id uuid not null references workflows(id) on delete cascade,
    source_url text not null,
    payload jsonb not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_extracted_data_workflow_id on extracted_data(workflow_id);
create index if not exists idx_workflows_created_at on workflows(created_at desc);

alter table workflows enable row level security;
alter table extracted_data enable row level security;

create policy "public read workflows" on workflows for select using (true);
create policy "public insert workflows" on workflows for insert with check (true);
create policy "public update workflows" on workflows for update using (true);

create policy "public read extracted_data" on extracted_data for select using (true);
create policy "public insert extracted_data" on extracted_data for insert with check (true);
