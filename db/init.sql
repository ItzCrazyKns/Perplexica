-- Enable required extensions
create extension if not exists "uuid-ossp";      -- For UUID generation
create extension if not exists pg_cron;          -- For scheduled jobs

-- Create the search_cache table
create table public.search_cache (
  id uuid default uuid_generate_v4() primary key,
  query text not null,
  results jsonb not null,
  location text not null,
  category text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone default timezone('utc'::text, now() + interval '7 days') not null
);

-- Create indexes
create index search_cache_query_idx on public.search_cache (query);
create index search_cache_location_category_idx on public.search_cache (location, category);
create index search_cache_expires_at_idx on public.search_cache (expires_at);

-- Enable RLS
alter table public.search_cache enable row level security;

-- Create policies
create policy "Allow public read access"
  on public.search_cache for select
  using (true);

create policy "Allow service write access"
  on public.search_cache for insert
  with check (true);

create policy "Allow service update access"
  on public.search_cache for update
  using (true)
  with check (true);

create policy "Allow delete expired records"
  on public.search_cache for delete
  using (expires_at < now());

-- Create function to clean up expired records
create or replace function cleanup_expired_cache()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.search_cache
  where expires_at < now();
end;
$$;

-- Create a manual cleanup function since pg_cron might not be available
create or replace function manual_cleanup()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.search_cache
  where expires_at < now();
end;
$$;

-- Create a view for cache statistics
create or replace view cache_stats as
select
  count(*) as total_entries,
  count(*) filter (where expires_at < now()) as expired_entries,
  count(*) filter (where expires_at >= now()) as valid_entries,
  min(created_at) as oldest_entry,
  max(created_at) as newest_entry,
  count(distinct category) as unique_categories,
  count(distinct location) as unique_locations
from public.search_cache;

-- Grant permissions to access the view
grant select on cache_stats to postgres;

-- Create table if not exists businesses
create table if not exists businesses (
  id text primary key,
  name text not null,
  phone text,
  email text,
  address text,
  rating numeric,
  website text,
  logo text,
  source text,
  description text,
  latitude numeric,
  longitude numeric,
  last_updated timestamp with time zone default timezone('utc'::text, now()),
  search_count integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create indexes for common queries
create index if not exists businesses_name_idx on businesses (name);
create index if not exists businesses_rating_idx on businesses (rating desc);
create index if not exists businesses_search_count_idx on businesses (search_count desc);
create index if not exists businesses_last_updated_idx on businesses (last_updated desc);

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    rating INTEGER,
    website TEXT,
    logo TEXT,
    source TEXT,
    description TEXT,
    location JSONB,
    place_id TEXT,
    photos TEXT[],
    opening_hours TEXT[],
    distance JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    search_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS searches (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    location TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    results_count INTEGER
);

CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_businesses_location ON businesses USING GIN (location);
CREATE INDEX IF NOT EXISTS idx_businesses_search ON businesses USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache (expires_at);

-- Set up RLS (Row Level Security)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow anonymous select" ON businesses FOR SELECT USING (true);
CREATE POLICY "Allow service role insert" ON businesses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role update" ON businesses FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous select" ON searches FOR SELECT USING (true);
CREATE POLICY "Allow service role insert" ON searches FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous select" ON cache FOR SELECT USING (true);
CREATE POLICY "Allow service role all" ON cache USING (true);

-- Add place_id column to businesses table if it doesn't exist
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS place_id TEXT;
CREATE INDEX IF NOT EXISTS idx_businesses_place_id ON businesses(place_id);

-- Create a unique constraint on place_id (excluding nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_place_id_unique 
ON businesses(place_id) 
WHERE place_id IS NOT NULL; 

CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    description TEXT NOT NULL,
    website TEXT,
    source TEXT NOT NULL,
    rating REAL,
    lat REAL,
    lng REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_businesses_source ON businesses(source);
CREATE INDEX IF NOT EXISTS idx_businesses_rating ON businesses(rating); 