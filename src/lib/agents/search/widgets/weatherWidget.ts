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

const weatherWidget: Widget<typeof WeatherWidgetSchema> = {
  name: 'weather',
  description: `Provides comprehensive current weather information and forecasts for any location worldwide. Returns real-time weather data including temperature, conditions, humidity, wind, and multi-day forecasts.

You can set skipSearch to true if the weather widget can fully answer the user's query without needing additional web search.

**What it provides:**
- Current weather conditions (temperature, feels-like, humidity, precipitation)
- Wind speed, direction, and gusts
- Weather codes/conditions (clear, cloudy, rainy, etc.)
- Hourly forecast for next 24 hours
- Daily forecast for next 7 days (high/low temps, precipitation probability)
- Timezone information

**When to use:**
- User asks about weather in a location ("weather in X", "is it raining in Y")
- Questions about temperature, conditions, or forecast
- Any weather-related query for a specific place

**Example call:**
{
  "type": "weather",
  "location": "San Francisco, CA, USA",
  "lat": 0,
  "lon": 0
}

**Important:** Provide EITHER a location name OR latitude/longitude coordinates, never both. If using location name, set lat/lon to 0. Location should be specific (city, state/region, country) for best results.`,
  schema: WeatherWidgetSchema,
  execute: async (params, _) => {
    try {
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
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=7`,
          {
            headers: {
              'User-Agent': 'Perplexica',
              'Content-Type': 'application/json',
            },
          },
        );

        const weatherData = await weatherRes.json();

        return {
          type: 'weather',
          llmContext: `Weather in ${params.location} is ${weatherData.current}`,
          data: {
            location: params.location,
            latitude: location.lat,
            longitude: location.lon,
            current: weatherData.current,
            hourly: {
              time: weatherData.hourly.time.slice(0, 24),
              temperature_2m: weatherData.hourly.temperature_2m.slice(0, 24),
              precipitation_probability:
                weatherData.hourly.precipitation_probability.slice(0, 24),
              precipitation: weatherData.hourly.precipitation.slice(0, 24),
              weather_code: weatherData.hourly.weather_code.slice(0, 24),
            },
            daily: weatherData.daily,
            timezone: weatherData.timezone,
          },
        };
      } else if (params.lat !== undefined && params.lon !== undefined) {
        const [weatherRes, locationRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${params.lat}&longitude=${params.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=7`,
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
          llmContext: `Weather in ${locationData.display_name} is ${weatherData.current}`,
          data: {
            location: locationData.display_name,
            latitude: params.lat,
            longitude: params.lon,
            current: weatherData.current,
            hourly: {
              time: weatherData.hourly.time.slice(0, 24),
              temperature_2m: weatherData.hourly.temperature_2m.slice(0, 24),
              precipitation_probability:
                weatherData.hourly.precipitation_probability.slice(0, 24),
              precipitation: weatherData.hourly.precipitation.slice(0, 24),
              weather_code: weatherData.hourly.weather_code.slice(0, 24),
            },
            daily: weatherData.daily,
            timezone: weatherData.timezone,
          },
        };
      }

      return {
        type: 'weather',
        llmContext: 'No valid location or coordinates provided.',
        data: null,
      };
    } catch (err) {
      return {
        type: 'weather',
        llmContext: 'Failed to fetch weather data.',
        data: {
          error: `Error fetching weather data: ${err}`,
        },
      };
    }
  },
};
export default weatherWidget;
