import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Initialize database tables
async function initializeTables() {
  try {
    // Create businesses table if it doesn't exist
    const { error: businessError } = await supabase.from('businesses').select('id').limit(1);
    
    if (businessError?.code === 'PGRST204') {
      const { error } = await supabase.rpc('execute_sql', {
        sql_string: `
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
        `
      });
      if (error) console.error('Error creating businesses table:', error);
    }

    // Create business_profiles table if it doesn't exist
    const { error: profileError } = await supabase.from('business_profiles').select('business_id').limit(1);
    
    if (profileError?.code === 'PGRST204') {
      const { error } = await supabase.rpc('execute_sql', {
        sql_string: `
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

          CREATE INDEX IF NOT EXISTS idx_business_profiles_claimed_by ON public.business_profiles(claimed_by);
          CREATE INDEX IF NOT EXISTS idx_business_claims_business_id ON public.business_claims(business_id);
          CREATE INDEX IF NOT EXISTS idx_business_claims_user_id ON public.business_claims(user_id);
          CREATE INDEX IF NOT EXISTS idx_business_claims_status ON public.business_claims(status);

          ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.business_profiles;
          CREATE POLICY "Public profiles are viewable by everyone" 
              ON public.business_profiles FOR SELECT 
              USING (true);

          DROP POLICY IF EXISTS "Profiles can be updated by verified owners" ON public.business_profiles;
          CREATE POLICY "Profiles can be updated by verified owners" 
              ON public.business_profiles FOR UPDATE 
              USING (auth.uid() = claimed_by AND verification_status = 'verified');

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
        `
      });
      if (error) console.error('Error creating profile tables:', error);
    }

    // Insert test data
    const { error: testDataError } = await supabase
      .from('businesses')
      .insert([
        {
          id: 'test-business-1',
          name: 'Test Coffee Shop',
          phone: '303-555-0123',
          email: 'contact@testcoffee.com',
          address: '123 Test St, Denver, CO 80202',
          rating: 4.5,
          website: 'https://testcoffee.com',
          description: 'A cozy coffee shop in downtown Denver serving artisanal coffee and pastries.',
          source: 'manual'
        }
      ])
      .select()
      .single();

    if (testDataError) {
      console.error('Error inserting test data:', testDataError);
    }

    // Create test business profile
    const { error: testProfileError } = await supabase
      .from('business_profiles')
      .insert([
        {
          business_id: 'test-business-1',
          verification_status: 'unverified',
          social_links: {
            facebook: 'https://facebook.com/testcoffee',
            instagram: 'https://instagram.com/testcoffee'
          },
          hours_of_operation: {
            monday: ['7:00', '19:00'],
            tuesday: ['7:00', '19:00'],
            wednesday: ['7:00', '19:00'],
            thursday: ['7:00', '19:00'],
            friday: ['7:00', '20:00'],
            saturday: ['8:00', '20:00'],
            sunday: ['8:00', '18:00']
          },
          tags: ['coffee', 'pastries', 'breakfast', 'lunch']
        }
      ])
      .select()
      .single();

    if (testProfileError) {
      console.error('Error creating test profile:', testProfileError);
    }
  } catch (error) {
    console.error('Error initializing tables:', error);
  }
}

// Call initialization on startup
initializeTables();

// Schema for business profile updates
const profileUpdateSchema = z.object({
  social_links: z.record(z.string()).optional(),
  hours_of_operation: z.record(z.array(z.string())).optional(),
  additional_photos: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

// Schema for claim submissions
const claimSubmissionSchema = z.object({
  business_id: z.string(),
  proof_documents: z.array(z.string()),
  notes: z.string().optional(),
});

// Get business profile
router.get('/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;

    // Get business details and profile
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select(`
        *,
        business_profiles (*)
      `)
      .eq('id', businessId)
      .single();

    if (businessError) throw businessError;
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json(business);
  } catch (error) {
    console.error('Error fetching business profile:', error);
    res.status(500).json({ error: 'Failed to fetch business profile' });
  }
});

// Update business profile (requires authentication)
router.patch('/:businessId/profile', authenticateUser, async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;
    const updates = profileUpdateSchema.parse(req.body);

    // Check if user owns this profile
    const { data: profile } = await supabase
      .from('business_profiles')
      .select('claimed_by, verification_status')
      .eq('business_id', businessId)
      .single();

    if (!profile || profile.claimed_by !== userId || profile.verification_status !== 'verified') {
      return res.status(403).json({ error: 'Not authorized to update this profile' });
    }

    // Update profile
    const { error: updateError } = await supabase
      .from('business_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', businessId);

    if (updateError) throw updateError;

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating business profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Submit a claim for a business
router.post('/claim', authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;
    const claim = claimSubmissionSchema.parse(req.body);

    // Check if business exists
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', claim.business_id)
      .single();

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check if business is already claimed
    const { data: existingProfile } = await supabase
      .from('business_profiles')
      .select('claimed_by')
      .eq('business_id', claim.business_id)
      .single();

    if (existingProfile?.claimed_by) {
      return res.status(400).json({ error: 'Business is already claimed' });
    }

    // Check for existing pending claims
    const { data: existingClaim } = await supabase
      .from('business_claims')
      .select('id')
      .eq('business_id', claim.business_id)
      .eq('status', 'pending')
      .single();

    if (existingClaim) {
      return res.status(400).json({ error: 'A pending claim already exists for this business' });
    }

    // Create claim
    const { error: claimError } = await supabase
      .from('business_claims')
      .insert({
        business_id: claim.business_id,
        user_id: userId,
        proof_documents: claim.proof_documents,
        notes: claim.notes,
      });

    if (claimError) throw claimError;

    res.json({ message: 'Claim submitted successfully' });
  } catch (error) {
    console.error('Error submitting business claim:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

// Get claims for a business (admin only)
router.get('/:businessId/claims', authenticateUser, async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('raw_app_meta_data')
      .eq('id', userId)
      .single();

    if (user?.raw_app_meta_data?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: claims, error } = await supabase
      .from('business_claims')
      .select(`
        *,
        user:user_id (
          email
        )
      `)
      .eq('business_id', businessId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json(claims);
  } catch (error) {
    console.error('Error fetching business claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// Review a claim (admin only)
router.post('/claims/:claimId/review', authenticateUser, async (req, res) => {
  try {
    const { claimId } = req.params;
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;
    const { status, notes } = z.object({
      status: z.enum(['approved', 'rejected']),
      notes: z.string().optional(),
    }).parse(req.body);

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('raw_app_meta_data')
      .eq('id', userId)
      .single();

    if (user?.raw_app_meta_data?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get claim details
    const { data: claim } = await supabase
      .from('business_claims')
      .select('business_id, status')
      .eq('id', claimId)
      .single();

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({ error: 'Claim has already been reviewed' });
    }

    // Start a transaction
    const { error: updateError } = await supabase.rpc('review_business_claim', {
      p_claim_id: claimId,
      p_business_id: claim.business_id,
      p_user_id: userId,
      p_status: status,
      p_notes: notes
    });

    if (updateError) throw updateError;

    res.json({ message: 'Claim reviewed successfully' });
  } catch (error) {
    console.error('Error reviewing business claim:', error);
    res.status(500).json({ error: 'Failed to review claim' });
  }
});

export default router; 