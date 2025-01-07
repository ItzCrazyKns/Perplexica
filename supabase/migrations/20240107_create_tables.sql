-- Function to create businesses table
CREATE OR REPLACE FUNCTION create_businesses_table()
RETURNS void AS $$
BEGIN
    CREATE TABLE IF NOT EXISTS public.businesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        rating NUMERIC,
        website TEXT,
        description TEXT,
        source TEXT,
        logo TEXT,
        latitude NUMERIC,
        longitude NUMERIC,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        search_count INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        place_id TEXT
    );
END;
$$ LANGUAGE plpgsql;

-- Function to create business_profiles table
CREATE OR REPLACE FUNCTION create_business_profiles_table()
RETURNS void AS $$
BEGIN
    CREATE TABLE IF NOT EXISTS public.business_profiles (
        business_id TEXT PRIMARY KEY REFERENCES public.businesses(id),
        claimed_by UUID REFERENCES auth.users(id),
        claimed_at TIMESTAMP WITH TIME ZONE,
        verification_status TEXT NOT NULL DEFAULT 'unverified',
        social_links JSONB DEFAULT '{}',
        hours_of_operation JSONB DEFAULT '{}',
        additional_photos TEXT[] DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_verification_status CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'))
    );

    -- Create business_claims table
    CREATE TABLE IF NOT EXISTS public.business_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id TEXT NOT NULL REFERENCES public.businesses(id),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        status TEXT NOT NULL DEFAULT 'pending',
        proof_documents TEXT[] DEFAULT '{}',
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reviewed_by UUID REFERENCES auth.users(id),
        notes TEXT,
        CONSTRAINT valid_claim_status CHECK (status IN ('pending', 'approved', 'rejected'))
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_business_profiles_claimed_by ON public.business_profiles(claimed_by);
    CREATE INDEX IF NOT EXISTS idx_business_claims_business_id ON public.business_claims(business_id);
    CREATE INDEX IF NOT EXISTS idx_business_claims_user_id ON public.business_claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_business_claims_status ON public.business_claims(status);

    -- Add RLS policies
    ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;

    -- Policies for business_profiles
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.business_profiles;
    CREATE POLICY "Public profiles are viewable by everyone" 
        ON public.business_profiles FOR SELECT 
        USING (true);

    DROP POLICY IF EXISTS "Profiles can be updated by verified owners" ON public.business_profiles;
    CREATE POLICY "Profiles can be updated by verified owners" 
        ON public.business_profiles FOR UPDATE 
        USING (auth.uid() = claimed_by AND verification_status = 'verified');

    -- Policies for business_claims
    DROP POLICY IF EXISTS "Users can view their own claims" ON public.business_claims;
    CREATE POLICY "Users can view their own claims" 
        ON public.business_claims FOR SELECT 
        USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can create claims" ON public.business_claims;
    CREATE POLICY "Users can create claims" 
        ON public.business_claims FOR INSERT 
        WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Only admins can review claims" ON public.business_claims;
    CREATE POLICY "Only admins can review claims" 
        ON public.business_claims FOR UPDATE 
        USING (EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_app_meta_data->>'role' = 'admin'
        ));
END;
$$ LANGUAGE plpgsql; 