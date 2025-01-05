export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export function normalizeAddress(address: string): string {
  // Remove common suffixes and standardize format
  return address
    .toLowerCase()
    .replace(/(street|st\.?|avenue|ave\.?|road|rd\.?)/g, '')
    .trim();
}

export function extractZipCode(text: string): string | null {
  const match = text.match(/\b\d{5}(?:-\d{4})?\b/);
  return match ? match[0] : null;
}

export function calculateReliabilityScore(business: Business): number {
  let score = 0;
  
  // More complete data = higher score
  if (business.phone) score += 2;
  if (business.website) score += 1;
  if (business.email) score += 1;
  if (business.hours) score += 2;
  if (business.services.length > 0) score += 1;
  if (business.reviewCount > 10) score += 2;
  
  return score;
} 