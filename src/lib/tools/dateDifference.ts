import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { DateTime, Interval } from 'luxon';
import { parseDate, getDateParseErrorMessage } from '@/lib/utils/dates';

/**
 * Tool that calculates the difference between two dates
 */
export const dateDifferenceTool = tool(
  ({ startDate, endDate }: { startDate: string; endDate: string }): string => {
    try {
      console.log(`Calculating difference between "${startDate}" and "${endDate}"`);
      
      // Parse the dates using the extracted utility function
      const startDateTime = parseDate(startDate);
      const endDateTime = parseDate(endDate);
      
      // Check if dates are valid
      if (!startDateTime.isValid) {
        return getDateParseErrorMessage(startDate, startDateTime, 'start date');
      }
      
      if (!endDateTime.isValid) {
        return getDateParseErrorMessage(endDate, endDateTime, 'end date');
      }
      
      // Create an interval between the two dates for accurate calculations
      const interval = Interval.fromDateTimes(startDateTime, endDateTime);
      
      if (!interval.isValid) {
        return `Error: Invalid interval between dates. Reason: ${interval.invalidReason}`;
      }
      
      // Calculate differences in various units using Luxon's accurate methods
      const diffMilliseconds = Math.abs(endDateTime.diff(startDateTime).toMillis());
      const diffSeconds = Math.abs(endDateTime.diff(startDateTime, 'seconds').seconds);
      const diffMinutes = Math.abs(endDateTime.diff(startDateTime, 'minutes').minutes);
      const diffHours = Math.abs(endDateTime.diff(startDateTime, 'hours').hours);
      const diffDays = Math.abs(endDateTime.diff(startDateTime, 'days').days);
      const diffWeeks = Math.abs(endDateTime.diff(startDateTime, 'weeks').weeks);
      const diffMonths = Math.abs(endDateTime.diff(startDateTime, 'months').months);
      const diffYears = Math.abs(endDateTime.diff(startDateTime, 'years').years);
      
      // Get multi-unit breakdown for more human-readable output
      const multiUnitDiff = endDateTime.diff(startDateTime, ['years', 'months', 'days', 'hours', 'minutes', 'seconds']).toObject();
      
      // Determine which date is earlier
      const isStartEarlier = startDateTime <= endDateTime;
      const earlierDate = isStartEarlier ? startDateTime : endDateTime;
      const laterDate = isStartEarlier ? endDateTime : startDateTime;
      
      // Format the dates for display with ISO format
      const formatDate = (dt: DateTime) => {
        return `${dt.toLocaleString(DateTime.DATETIME_FULL)} (${dt.toISO()})`;
      };
      
      let result = `Date difference calculation:
From: ${formatDate(earlierDate)}
To: ${formatDate(laterDate)}

Human-readable breakdown:`;

      // Add human-readable breakdown
      if (multiUnitDiff.years && Math.abs(multiUnitDiff.years) >= 1) {
        result += `\n• ${Math.floor(Math.abs(multiUnitDiff.years))} year${Math.abs(multiUnitDiff.years) >= 2 ? 's' : ''}`;
      }
      if (multiUnitDiff.months && Math.abs(multiUnitDiff.months) >= 1) {
        result += `\n• ${Math.floor(Math.abs(multiUnitDiff.months))} month${Math.abs(multiUnitDiff.months) >= 2 ? 's' : ''}`;
      }
      if (multiUnitDiff.days && Math.abs(multiUnitDiff.days) >= 1) {
        result += `\n• ${Math.floor(Math.abs(multiUnitDiff.days))} day${Math.abs(multiUnitDiff.days) >= 2 ? 's' : ''}`;
      }
      if (multiUnitDiff.hours && Math.abs(multiUnitDiff.hours) >= 1) {
        result += `\n• ${Math.floor(Math.abs(multiUnitDiff.hours))} hour${Math.abs(multiUnitDiff.hours) >= 2 ? 's' : ''}`;
      }
      if (multiUnitDiff.minutes && Math.abs(multiUnitDiff.minutes) >= 1) {
        result += `\n• ${Math.floor(Math.abs(multiUnitDiff.minutes))} minute${Math.abs(multiUnitDiff.minutes) >= 2 ? 's' : ''}`;
      }
      if (multiUnitDiff.seconds && Math.abs(multiUnitDiff.seconds) >= 1) {
        result += `\n• ${Math.floor(Math.abs(multiUnitDiff.seconds))} second${Math.abs(multiUnitDiff.seconds) >= 2 ? 's' : ''}`;
      }

      result += `\n\nTotal measurements:
• Total years: ${diffYears.toFixed(2)}
• Total months: ${diffMonths.toFixed(2)}
• Total weeks: ${diffWeeks.toFixed(2)}
• Total days: ${diffDays.toFixed(2)}
• Total hours: ${diffHours.toFixed(2)}
• Total minutes: ${diffMinutes.toFixed(2)}
• Total seconds: ${diffSeconds.toFixed(2)}
• Total milliseconds: ${diffMilliseconds}

Direction: Start date is ${isStartEarlier ? 'earlier than' : 'later than'} the end date.`;

      return result;
      
    } catch (error) {
      console.error('Error during date difference calculation:', error);
      return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred during date difference calculation'}`;
    }
  },
  {
    name: 'date_difference',
    description: 'Calculate the time difference between two dates. Returns a detailed breakdown of years, months, days, hours, etc. If no timezone is specified, dates will be treated as local to the server time.',
    schema: z.object({
      startDate: z.string().describe('The start date (e.g., "2024-01-15", "Jan 15, 2024", "2024-01-15 14:30:00Z", "2024-01-15T14:30:00-05:00")'),
      endDate: z.string().describe('The end date (e.g., "2024-12-25", "Dec 25, 2024", "2024-12-25 18:00:00Z", "2024-12-25T18:00:00-05:00")'),
    }),
  }
);
