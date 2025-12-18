const fetch = require('node-fetch');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

exports.handler = async (event, context) => {
  const { lat, lon } = event.queryStringParameters;

  if (!lat || !lon) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Latitude dan Longitude dibutuhkan.' }),
    };
  }

  const apiUrl = `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=id`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const weatherData = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weatherData),
    };

  } catch (error) {
    console.error('Error fetching weather:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Gagal mengambil data cuaca.' }),
    };
  }
};