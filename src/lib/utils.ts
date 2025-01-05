import crypto from 'crypto';

interface BusinessIdentifier {
    title?: string;
    name?: string;
    phone?: string;
    address?: string;
    url?: string;
    website?: string;
}

export function generateBusinessId(business: BusinessIdentifier): string {
    const components = [
        business.title || business.name,
        business.phone,
        business.address,
        business.url || business.website
    ].filter(Boolean);

    const hash = crypto.createHash('md5')
        .update(components.join('|'))
        .digest('hex');

    return `hash_${hash}`;
}

export function extractPlaceIdFromUrl(url: string): string | null {
    try {
        // Match patterns like:
        // https://www.google.com/maps/place/.../.../data=!3m1!4b1!4m5!3m4!1s0x876c7ed0cb78d6d3:0x2cd0c4490736f7c!8m2!
        // https://maps.google.com/maps?q=...&ftid=0x876c7ed0cb78d6d3:0x2cd0c4490736f7c
        const placeIdRegex = /[!\/]([0-9a-f]{16}:[0-9a-f]{16})/i;
        const match = url.match(placeIdRegex);
        return match ? match[1] : null;
    } catch (error) {
        console.warn('Error extracting place ID from URL:', error);
        return null;
    }
} 