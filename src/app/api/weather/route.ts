import { getTranslations } from 'next-intl/server';

export const POST = async (req: Request) => {
  try {
    const t = await getTranslations('weather.conditions');
    const body: {
      lat: number;
      lng: number;
      measureUnit: 'Imperial' | 'Metric';
    } = await req.json();

    if (!body.lat || !body.lng) {
      return Response.json(
        {
          message: 'Invalid request.',
        },
        { status: 400 },
      );
    }

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${body.lat}&longitude=${body.lng}&current=weather_code,temperature_2m,is_day,relative_humidity_2m,wind_speed_10m&timezone=auto${
        body.measureUnit === 'Metric' ? '' : '&temperature_unit=fahrenheit'
      }${body.measureUnit === 'Metric' ? '' : '&wind_speed_unit=mph'}`,
    );

    const data = await res.json();

    if (data.error) {
      console.error(`Error fetching weather data: ${data.reason}`);
      return Response.json(
        {
          message: 'An error has occurred.',
        },
        { status: 500 },
      );
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
        weather.condition = t('clear');
        break;

      case 1:
        weather.condition = t('mainlyClear');
      case 2:
        weather.condition = t('partlyCloudy');
      case 3:
        weather.icon = `cloudy-1-${dayOrNight}`;
        weather.condition = t('cloudy');
        break;

      case 45:
        weather.condition = t('fog');
      case 48:
        weather.icon = `fog-${dayOrNight}`;
        weather.condition = t('fog');
        break;

      case 51:
        weather.condition = t('lightDrizzle');
      case 53:
        weather.condition = t('moderateDrizzle');
      case 55:
        weather.icon = `rainy-1-${dayOrNight}`;
        weather.condition = t('denseDrizzle');
        break;

      case 56:
        weather.condition = t('lightFreezingDrizzle');
      case 57:
        weather.icon = `frost-${dayOrNight}`;
        weather.condition = t('denseFreezingDrizzle');
        break;

      case 61:
        weather.condition = t('slightRain');
      case 63:
        weather.condition = t('moderateRain');
      case 65:
        weather.condition = t('heavyRain');
        weather.icon = `rainy-2-${dayOrNight}`;
        break;

      case 66:
        weather.condition = t('lightFreezingRain');
      case 67:
        weather.condition = t('heavyFreezingRain');
        weather.icon = 'rain-and-sleet-mix';
        break;

      case 71:
        weather.condition = t('slightSnowFall');
      case 73:
        weather.condition = t('moderateSnowFall');
      case 75:
        weather.condition = t('heavySnowFall');
        weather.icon = `snowy-2-${dayOrNight}`;
        break;

      case 77:
        weather.condition = t('snow');
        weather.icon = `snowy-1-${dayOrNight}`;
        break;

      case 80:
        weather.condition = t('slightRainShowers');
      case 81:
        weather.condition = t('moderateRainShowers');
      case 82:
        weather.condition = t('heavyRainShowers');
        weather.icon = `rainy-3-${dayOrNight}`;
        break;

      case 85:
        weather.condition = t('slightSnowShowers');
      case 86:
        weather.condition = t('moderateSnowShowers');
      case 87:
        weather.condition = t('heavySnowShowers');
        weather.icon = `snowy-3-${dayOrNight}`;
        break;

      case 95:
        weather.condition = t('thunderstorm');
        weather.icon = `scattered-thunderstorms-${dayOrNight}`;
        break;

      case 96:
        weather.condition = t('thunderstormSlightHail');
      case 99:
        weather.condition = t('thunderstormHeavyHail');
        weather.icon = 'severe-thunderstorm';
        break;

      default:
        weather.icon = `clear-${dayOrNight}`;
        weather.condition = t('clear');
        break;
    }

    return Response.json(weather);
  } catch (err) {
    console.error('An error occurred while getting home widgets', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};
