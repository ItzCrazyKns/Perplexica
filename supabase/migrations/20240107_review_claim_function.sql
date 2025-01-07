-- Function to review business claims
CREATE OR REPLACE FUNCTION review_business_claim(
    p_claim_id UUID,
    p_business_id TEXT,
    p_user_id UUID,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Start transaction
    BEGIN
        -- Update claim status
        UPDATE public.business_claims
        SET 
            status = p_status,
            reviewed_at = CURRENT_TIMESTAMP,
            reviewed_by = p_user_id,
            notes = COALESCE(p_notes, notes)
        WHERE id = p_claim_id;

        -- If approved, update business profile
        IF p_status = 'approved' THEN
            -- Get the user_id from the claim
            WITH claim_user AS (
                SELECT user_id 
                FROM public.business_claims 
                WHERE id = p_claim_id
            )
            INSERT INTO public.business_profiles (
                business_id,
                claimed_by,
                claimed_at,
                verification_status
            )
            SELECT 
                p_business_id,
                user_id,
                CURRENT_TIMESTAMP,
                'verified'
            FROM claim_user
            ON CONFLICT (business_id) 
            DO UPDATE SET
                claimed_by = EXCLUDED.claimed_by,
                claimed_at = EXCLUDED.claimed_at,
                verification_status = EXCLUDED.verification_status;
        END IF;

        -- Reject any other pending claims for this business
        IF p_status = 'approved' THEN
            UPDATE public.business_claims
            SET 
                status = 'rejected',
                reviewed_at = CURRENT_TIMESTAMP,
                reviewed_by = p_user_id,
                notes = COALESCE(notes, '') || E'\nAutomatically rejected due to another approved claim.'
            WHERE 
                business_id = p_business_id 
                AND id != p_claim_id 
                AND status = 'pending';
        END IF;
    END;
END;
$$ LANGUAGE plpgsql; 