-- Emule sur PostgreSQL standard l'environnement Supabase attendu par les migrations.
set client_min_messages = warning;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $$;
create function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;

create schema vault;
create schema extensions;
