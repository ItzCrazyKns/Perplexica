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
    temperatureUnit: 'C',
    windSpeedUnit: 'm/s',
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const IPWHOIS_CACHE_KEY = 'ipwhois_cache_v1';
    const IPWHOIS_TTL_MS = 1000 * 60 * 20; // 20 minutes

    const getApproxLocation = async () => {
      try {
        const raw = sessionStorage.getItem(IPWHOIS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.ts && Date.now() - parsed.ts < IPWHOIS_TTL_MS && parsed?.data) {
            return parsed.data;
          }
        }

        const res = await fetch('https://ipwhois.app/json/');
        const data = await res.json();

        const payload = {
          ts: Date.now(),
          data: {
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city,
          },
        };

        try {
          sessionStorage.setItem(IPWHOIS_CACHE_KEY, JSON.stringify(payload));
        } catch (e) {
          // ignore storage errors (e.g., quota)
        }

        return payload.data;
      } catch (err) {
        // If anything goes wrong, fall back to a safe default
        return { latitude: 0, longitude: 0, city: '' };
      }
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
          measureUnit: localStorage.getItem('measureUnit') ?? 'Metric',
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
        temperatureUnit: data.temperatureUnit,
        windSpeedUnit: data.windSpeedUnit,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="bg-surface rounded-xl border border-surface-2 shadow-sm flex flex-row items-center w-full h-24 min-h-[96px] max-h-[96px] px-3 py-2 gap-3">
      {loading ? (
        <>
          <div className="flex flex-col items-center justify-center w-16 min-w-16 max-w-16 h-full animate-pulse">
            <div className="h-10 w-10 rounded-full bg-surface-2 mb-2" />
            <div className="h-4 w-10 rounded bg-surface-2" />
          </div>
          <div className="flex flex-col justify-between flex-1 h-full py-1 animate-pulse">
            <div className="flex flex-row items-center justify-between">
              <div className="h-3 w-20 rounded bg-surface-2" />
              <div className="h-3 w-12 rounded bg-surface-2" />
            </div>
            <div className="h-3 w-16 rounded bg-surface-2 mt-1" />
            <div className="flex flex-row justify-between w-full mt-auto pt-1 border-t border-surface-2">
              <div className="h-3 w-16 rounded bg-surface-2" />
              <div className="h-3 w-8 rounded bg-surface-2" />
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
            <span className="text-base font-semibold text-fg">
              {data.temperature}°{data.temperatureUnit}
            </span>
          </div>
          <div className="flex flex-col justify-between flex-1 h-full py-1">
            <div className="flex flex-row items-center justify-between">
              <span className="text-xs font-medium text-fg">
                {data.location}
              </span>
              <span className="flex items-center text-xs text-fg/60">
                <Wind className="w-3 h-3 mr-1" />
                {data.windSpeed} {data.windSpeedUnit}
              </span>
            </div>
            <span className="text-xs text-fg/60 mt-1">{data.condition}</span>
            <div className="flex flex-row justify-between w-full mt-auto pt-1 border-t border-surface-2 text-xs text-fg/60">
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
