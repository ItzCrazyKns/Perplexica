export const GET = async () => {
  try {
    const res = await fetch('https://ipwhois.app/json/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch location data');
    }

    const data = await res.json();

    return Response.json({
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      country: data.country,
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    return Response.json(
      { message: 'Failed to fetch location data' },
      { status: 500 }
    );
  }
};