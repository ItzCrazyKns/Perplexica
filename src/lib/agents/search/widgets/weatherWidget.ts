import z from 'zod';
import { Widget } from '../types';

const WeatherWidgetSchema = z.object({
  type: z.literal('weather'),
  location: z
    .string()
    .describe(
      'Human-readable location name (e.g., "New York, NY, USA", "London, UK"). Use this OR lat/lon coordinates, never both. Leave empty string if providing coordinates.',
    ),
  lat: z
    .number()
    .describe(
      'Latitude coordinate in decimal degrees (e.g., 40.7128). Only use when location name is empty.',
    ),
  lon: z
    .number()
    .describe(
      'Longitude coordinate in decimal degrees (e.g., -74.0060). Only use when location name is empty.',
    ),
});

const weatherWidget = {
  name: 'weather',
  description:
    'Provides current weather information for a specified location. It can return details such as temperature, humidity, wind speed, and weather conditions. It needs either a location name or latitude/longitude coordinates to function.',
  schema: WeatherWidgetSchema,
  execute: async (params, _) => {
    if (
      params.location === '' &&
      (params.lat === undefined || params.lon === undefined)
    ) {
      throw new Error(
        'Either location name or both latitude and longitude must be provided.',
      );
    }

    if (params.location !== '') {
      const openStreetMapUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(params.location)}&format=json&limit=1`;

      const locationRes = await fetch(openStreetMapUrl, {
        headers: {
          'User-Agent': 'Perplexica',
          'Content-Type': 'application/json',
        },
      });

      const data = await locationRes.json();

      const location = data[0];

      if (!location) {
        throw new Error(
          `Could not find coordinates for location: ${params.location}`,
        );
      }

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true`,
        {
          headers: {
            'User-Agent': 'Perplexica',
            'Content-Type': 'application/json',
          },
        },
      );

      const weatherData = await weatherRes.json();

      /* this is like a very simple implementation just to see the bacckend works, when we're working on the frontend, we'll return more data i guess? */
      return {
        type: 'weather',
        data: {
          location: params.location,
          latitude: location.lat,
          longitude: location.lon,
          weather: weatherData.current_weather,
        },
      };
    } else if (params.lat !== undefined && params.lon !== undefined) {
      const [weatherRes, locationRes] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${params.lat}&longitude=${params.lon}&current_weather=true`,
          {
            headers: {
              'User-Agent': 'Perplexica',
              'Content-Type': 'application/json',
            },
          },
        ),
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${params.lat}&lon=${params.lon}&format=json`,
          {
            headers: {
              'User-Agent': 'Perplexica',
              'Content-Type': 'application/json',
            },
          },
        ),
      ]);

      const weatherData = await weatherRes.json();
      const locationData = await locationRes.json();

      return {
        type: 'weather',
        data: {
          location: locationData.display_name,
          latitude: params.lat,
          longitude: params.lon,
          weather: weatherData.current_weather,
        },
      };
    }

    return {
      type: 'weather',
      data: null,
    };
  },
} satisfies Widget<typeof WeatherWidgetSchema>;

export default weatherWidget;
