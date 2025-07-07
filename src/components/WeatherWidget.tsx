import { Cloud, Sun, CloudRain, CloudSnow, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';

const WeatherWidget = () => {
  const [data, setData] = useState({
    temperature: 0,
    condition: '',
    location: '',
    humidity: 0,
    windSpeed: 0,
    icon: '',
  });
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<'C' | 'F'>('C');

  const convertTemperature = (tempCelsius: number, targetUnit: 'C' | 'F') => {
    if (targetUnit === 'F') {
      return ((tempCelsius * 9) / 5 + 32).toFixed(1);
    }
    return tempCelsius.toFixed(1);
  };

  const toggleUnit = () => {
    setUnit((prev) => (prev === 'C' ? 'F' : 'C'));
  };

  useEffect(() => {
    const getApproxLocation = async () => {
      const res = await fetch('https://ipwhois.app/json/');
      const data = await res.json();

      return {
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city,
      };
    };

    const getLocation = async (
      callback: (location: {
        latitude: number;
        longitude: number;
        city: string;
      }) => void,
    ) => {
      if (navigator.geolocation) {
        const result = await navigator.permissions.query({
          name: 'geolocation',
        });

        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(async (position) => {
            const res = await fetch(
              `https://api-bdc.io/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
              },
            );

            const data = await res.json();

            callback({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              city: data.locality,
            });
          });
        } else if (result.state === 'prompt') {
          callback(await getApproxLocation());
          navigator.geolocation.getCurrentPosition((position) => {});
        } else if (result.state === 'denied') {
          callback(await getApproxLocation());
        }
      } else {
        callback(await getApproxLocation());
      }
    };

    getLocation(async (location) => {
      const res = await fetch(`/api/weather`, {
        method: 'POST',
        body: JSON.stringify({
          lat: location.latitude,
          lng: location.longitude,
        }),
      });

      const data = await res.json();

      if (res.status !== 200) {
        console.error('Error fetching weather data');
        setLoading(false);
        return;
      }

      setData({
        temperature: data.temperature,
        condition: data.condition,
        location: location.city,
        humidity: data.humidity,
        windSpeed: data.windSpeed,
        icon: data.icon,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="bg-light-secondary dark:bg-dark-secondary rounded-xl border border-light-200 dark:border-dark-200 shadow-sm flex flex-row items-center w-full h-24 min-h-[96px] max-h-[96px] px-3 py-2 gap-3">
      {loading ? (
        <>
          <div className="flex flex-col items-center justify-center w-16 min-w-16 max-w-16 h-full animate-pulse">
            <div className="h-10 w-10 rounded-full bg-light-200 dark:bg-dark-200 mb-2" />
            <div className="h-4 w-10 rounded bg-light-200 dark:bg-dark-200" />
          </div>
          <div className="flex flex-col justify-between flex-1 h-full py-1 animate-pulse">
            <div className="flex flex-row items-center justify-between">
              <div className="h-3 w-20 rounded bg-light-200 dark:bg-dark-200" />
              <div className="h-3 w-12 rounded bg-light-200 dark:bg-dark-200" />
            </div>
            <div className="h-3 w-16 rounded bg-light-200 dark:bg-dark-200 mt-1" />
            <div className="flex flex-row justify-between w-full mt-auto pt-1 border-t border-light-200 dark:border-dark-200">
              <div className="h-3 w-16 rounded bg-light-200 dark:bg-dark-200" />
              <div className="h-3 w-8 rounded bg-light-200 dark:bg-dark-200" />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center w-16 min-w-16 max-w-16 h-full">
            <img
              src={`/weather-ico/${data.icon}.svg`}
              alt={data.condition}
              className="h-10 w-auto"
            />
            <div className="flex flex-col items-center space-y-1">
              <span className="text-base font-semibold text-black dark:text-white text-center leading-tight">
                {convertTemperature(data.temperature, unit)}°
              </span>
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5 shadow-inner">
                <button
                  onClick={toggleUnit}
                  className={`text-xs font-medium px-2 py-1 rounded-full transition-all duration-200 ${
                    unit === 'C'
                      ? 'text-white bg-blue-500 dark:bg-blue-600 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  °C
                </button>
                <button
                  onClick={toggleUnit}
                  className={`text-xs font-medium px-2 py-1 rounded-full transition-all duration-200 ${
                    unit === 'F'
                      ? 'text-white bg-blue-500 dark:bg-blue-600 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  °F
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between flex-1 h-full py-1">
            <div className="flex flex-row items-center justify-between">
              <span className="text-xs font-medium text-black dark:text-white">
                {data.location}
              </span>
              <span className="flex items-center text-xs text-black/60 dark:text-white/60">
                <Wind className="w-3 h-3 mr-1" />
                {data.windSpeed} km/h
              </span>
            </div>
            <span className="text-xs text-black/60 dark:text-white/60 mt-1">
              {data.condition}
            </span>
            <div className="flex flex-row justify-between w-full mt-auto pt-1 border-t border-light-200 dark:border-dark-200 text-xs text-black/60 dark:text-white/60">
              <span>Humidity: {data.humidity}%</span>
              <span>Now</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WeatherWidget;
