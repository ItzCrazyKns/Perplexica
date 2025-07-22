import { DateTime } from 'luxon';

/**
 * Parses a date string using multiple Luxon formats with fallback to JavaScript Date parsing.
 * Preserves timezone information when available using setZone: true.
 * 
 * @param dateString - The date string to parse
 * @returns A parsed DateTime object
 */
export function parseDate(dateString: string): DateTime {
  // Try to parse as ISO format first (most common)
  let dateTime = DateTime.fromISO(dateString, { setZone: true });
  
  // If ISO parsing fails, try other common formats
  if (!dateTime.isValid) {
    dateTime = DateTime.fromRFC2822(dateString, { setZone: true });
  }
  
  if (!dateTime.isValid) {
    dateTime = DateTime.fromHTTP(dateString, { setZone: true });
  }
  
  if (!dateTime.isValid) {
    dateTime = DateTime.fromSQL(dateString, { setZone: true });
  }
  
  // If all parsing attempts fail, try JavaScript Date parsing as fallback
  if (!dateTime.isValid) {
    const jsDate = new Date(dateString);
    if (!isNaN(jsDate.getTime())) {
      dateTime = DateTime.fromJSDate(jsDate);
    }
  }
  
  return dateTime;
}

/**
 * Generates a standardized error message for date parsing failures.
 * 
 * @param dateString - The original date string that failed to parse
 * @param dateTime - The invalid DateTime object
 * @param fieldName - Optional field name for more specific error messages (e.g., "start date", "end date")
 * @returns A formatted error message
 */
export function getDateParseErrorMessage(
  dateString: string, 
  dateTime: DateTime, 
  fieldName: string = 'date'
): string {
  return `Error: Unable to parse ${fieldName} "${dateString}". Please provide a valid date format (ISO 8601, RFC 2822, SQL, or common date formats). Reason: ${dateTime.invalidReason}`;
}
