-- Create the businesses table
create table businesses (
  id uuid primary key,
  name text not null,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  category text[],
  rating numeric,
  review_count integer,
  license text,
  services text[],
  hours jsonb,
  website text,
  email text,
  verified boolean default false,
  last_updated timestamp with time zone,
  search_query text,
  search_location text,
  search_timestamp timestamp with time zone,
  reliability_score integer,
  
  -- Create a composite index for deduplication
  constraint unique_business unique (phone, address)
);

-- Create indexes for common queries
create index idx_business_location on businesses (city, state);
create index idx_business_category on businesses using gin (category);
create index idx_search_query on businesses using gin (search_query gin_trgm_ops);
create index idx_search_location on businesses using gin (search_location gin_trgm_ops);
create index idx_reliability on businesses (reliability_score);

-- Enable full text search
alter table businesses add column search_vector tsvector 
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(search_query, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(search_location, '')), 'C')
  ) stored;

create index idx_business_search on businesses using gin(search_vector); 