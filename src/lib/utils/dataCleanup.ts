import { Business } from '../types';

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
  if (business.hours?.length) score += 2;
  if (business.services && business.services.length > 0) score += 1;
  if (business.reviewCount && business.reviewCount > 10) score += 2;
  
  return score;
}

export function cleanAddress(address: string): string {
  return address
    .replace(/^(Sure!|Here is |The business address( is| found in the text is)?:?\n?\s*)/i, '')
    .replace(/\n/g, ' ')
    .trim();
}

export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  }
  
  // Return original if not 10 digits
  return phone;
}

export function cleanEmail(email: string): string {
  // Remove phone numbers from email
  return email
    .replace(/\d{3}-\d{4}/, '')
    .replace(/\d{10}/, '')
    .trim();
}

export function cleanDescription(description: string): string {
  return description
    .replace(/^(Description:|About:|Info:)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
} 