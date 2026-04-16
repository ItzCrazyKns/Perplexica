import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';

export const POST = async (req: NextRequest) => {
  try {
    const auth = await requireAuth(req);
    if (!auth.success) return auth.error;

    const body: {
      lat: number;
      lng: number;
      measureUnit: 'Imperial' | 'Metric';
    } = await req.json();

    if (!body.lat || !body.lng) {
      return Response.json({ message: 'Invalid request.' }, { status: 400 });
    }

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${body.lat}&longitude=${body.lng}&current=weather_code,temperature_2m,is_day,relative_humidity_2m,wind_speed_10m&timezone=auto${
        body.measureUnit === 'Metric' ? '' : '&temperature_unit=fahrenheit'
      }${body.measureUnit === 'Metric' ? '' : '&wind_speed_unit=mph'}`,
    );

    const data = await res.json();

    if (data.error) {
      console.error(`Error fetching weather data: ${data.reason}`);
      return Response.json({ message: 'An error has occurred.' }, { status: 500 });
    }

    const weather: {
      temperature: number;
      condition: string;
      humidity: number;
      windSpeed: number;
      icon: string;
      temperatureUnit: 'C' | 'F';
      windSpeedUnit: 'm/s' | 'mph';
    } = {
      temperature: data.current.temperature_2m,
      condition: '',
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      icon: '',
      temperatureUnit: body.measureUnit === 'Metric' ? 'C' : 'F',
      windSpeedUnit: body.measureUnit === 'Metric' ? 'm/s' : 'mph',
    };

    const code = data.current.weather_code;
    const isDay = data.current.is_day === 1;
    const dayOrNight = isDay ? 'day' : 'night';

    switch (code) {
      case 0:
        weather.icon = `clear-${dayOrNight}`;
        weather.condition = 'Clear';
        break;
      case 1:
      case 2:
      case 3:
        weather.icon = `cloudy-1-${dayOrNight}`;
        weather.condition = code === 1 ? 'Mainly Clear' : code === 2 ? 'Partly Cloudy' : 'Cloudy';
        break;
      case 45:
      case 48:
        weather.icon = `fog-${dayOrNight}`;
        weather.condition = 'Fog';
        break;
      case 51:
      case 53:
      case 55:
        weather.icon = `rainy-1-${dayOrNight}`;
        weather.condition = code === 51 ? 'Light Drizzle' : code === 53 ? 'Moderate Drizzle' : 'Dense Drizzle';
        break;
      case 56:
      case 57:
        weather.icon = `frost-${dayOrNight}`;
        weather.condition = 'Freezing Drizzle';
        break;
      case 61:
      case 63:
      case 65:
        weather.icon = `rainy-2-${dayOrNight}`;
        weather.condition = code === 61 ? 'Slight Rain' : code === 63 ? 'Moderate Rain' : 'Heavy Rain';
        break;
      case 66:
      case 67:
        weather.icon = 'rain-and-sleet-mix';
        weather.condition = 'Freezing Rain';
        break;
      case 71:
      case 73:
      case 75:
        weather.icon = `snowy-2-${dayOrNight}`;
        weather.condition = code === 71 ? 'Slight Snow' : code === 73 ? 'Moderate Snow' : 'Heavy Snow';
        break;
      case 77:
        weather.icon = `snowy-1-${dayOrNight}`;
        weather.condition = 'Snow';
        break;
      case 80:
      case 81:
      case 82:
        weather.icon = `rainy-3-${dayOrNight}`;
        weather.condition = code === 80 ? 'Slight Rain Showers' : code === 81 ? 'Moderate Rain Showers' : 'Heavy Rain Showers';
        break;
      case 85:
      case 86:
      case 87:
        weather.icon = `snowy-3-${dayOrNight}`;
        weather.condition = code === 85 ? 'Slight Snow Showers' : code === 86 ? 'Moderate Snow Showers' : 'Heavy Snow Showers';
        break;
      case 95:
        weather.icon = `scattered-thunderstorms-${dayOrNight}`;
        weather.condition = 'Thunderstorm';
        break;
      case 96:
      case 99:
        weather.icon = 'severe-thunderstorm';
        weather.condition = 'Thunderstorm with Hail';
        break;
      default:
        weather.icon = `clear-${dayOrNight}`;
        weather.condition = 'Clear';
        break;
    }

    return Response.json(weather);
  } catch (err) {
    console.error('An error occurred while getting weather data:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
