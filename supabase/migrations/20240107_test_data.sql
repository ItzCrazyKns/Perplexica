-- Insert test business
INSERT INTO public.businesses (
    id,
    name,
    phone,
    email,
    address,
    rating,
    website,
    description,
    source
) VALUES (
    'test-business-1',
    'Test Coffee Shop',
    '303-555-0123',
    'contact@testcoffee.com',
    '123 Test St, Denver, CO 80202',
    4.5,
    'https://testcoffee.com',
    'A cozy coffee shop in downtown Denver serving artisanal coffee and pastries.',
    'manual'
) ON CONFLICT (id) DO NOTHING;

-- Insert test business profile
INSERT INTO public.business_profiles (
    business_id,
    verification_status,
    social_links,
    hours_of_operation,
    tags
) VALUES (
    'test-business-1',
    'unverified',
    '{"facebook": "https://facebook.com/testcoffee", "instagram": "https://instagram.com/testcoffee"}',
    '{"monday": ["7:00", "19:00"], "tuesday": ["7:00", "19:00"], "wednesday": ["7:00", "19:00"], "thursday": ["7:00", "19:00"], "friday": ["7:00", "20:00"], "saturday": ["8:00", "20:00"], "sunday": ["8:00", "18:00"]}',
    ARRAY['coffee', 'pastries', 'breakfast', 'lunch']
) ON CONFLICT (business_id) DO NOTHING; 