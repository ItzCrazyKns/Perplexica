import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { parseDate, getDateParseErrorMessage } from '@/lib/utils/dates';

/**
 * Tool that converts a date from one timezone to another
 */
export const timezoneConverterTool = tool(
  ({
    dateString,
    toTimezone,
  }: {
    dateString: string;
    toTimezone: string;
  }): string => {
    try {
      console.log(
        `Converting date "${dateString}" to timezone "${toTimezone}"`,
      );

      // Parse the date string using the extracted utility function
      const dateTime = parseDate(dateString);

      // Check if the parsed date is valid
      if (!dateTime.isValid) {
        return getDateParseErrorMessage(dateString, dateTime);
      }

      // Convert to target timezone
      const targetDateTime = dateTime.setZone(toTimezone);

      // Check if the target timezone is valid
      if (!targetDateTime.isValid) {
        return `Error: Invalid timezone "${toTimezone}". Please use valid timezone identifiers like "America/New_York", "Europe/London", "Asia/Tokyo", etc. Reason: ${targetDateTime.invalidReason}`;
      }

      // Format both dates as ISO 8601 with timezone offset
      const sourceISO = dateTime.toISO();
      const targetISO = targetDateTime.toISO();

      const output = `Date conversion result:
Source: ${sourceISO} (${dateTime.zoneName})
Target: ${targetISO} (${targetDateTime.zoneName})`;

      console.log(output);
      return output;
    } catch (error) {
      console.error('Error during timezone conversion:', error);
      return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred during timezone conversion'}`;
    }
  },
  {
    name: 'timezone_converter',
    description:
      'Convert a date from one timezone to another (Works best with ISO 8601 formatted dates) - Expects target timezone in the IANA format (e.g., "America/New_York", "Europe/London", etc.)',
    schema: z.object({
      dateString: z
        .string()
        .describe(
          'The date string to convert. This must include the timezone offset or Z for UTC (e.g., "2023-10-01T00:00:00Z" or "2025-08-10T00:00:00-06:00")',
        ),
      toTimezone: z
        .string()
        .describe(
          'Target timezone to convert to (e.g., "Asia/Tokyo", "America/Los_Angeles", "Europe/Paris")',
        ),
    }),
  },
);
