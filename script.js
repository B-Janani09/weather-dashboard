
const API_URLS = {
  geocoding: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast"
};

const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchButton = document.getElementById("search-button");
const statusMessage = document.getElementById("status-message");
const weatherContent = document.getElementById("weather-content");
const forecastList = document.getElementById("forecast-list");

let suggestionTimer;
let suggestionController;

const weatherDescriptions = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"],
  48: ["Depositing rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Moderate drizzle", "🌦️"],
  55: ["Dense drizzle", "🌧️"],
  56: ["Light freezing drizzle", "🌧️"],
  57: ["Dense freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Moderate rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Light freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snowfall", "🌨️"],
  73: ["Moderate snowfall", "🌨️"],
  75: ["Heavy snowfall", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Light rain showers", "🌦️"],
  81: ["Moderate rain showers", "🌧️"],
  82: ["Violent rain showers", "⛈️"],
  85: ["Light snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Severe thunderstorm with hail", "⛈️"]
};

function getWeather(code) {
  return weatherDescriptions[code] || ["Weather unavailable", "🌡️"];
}

function showStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
}

async function fetchJSON(url, signal) {
  const response = await fetch(url, { signal });

  // Check the HTTP status before trying to parse the response.
  if (!response.ok) {
    throw new Error(`Weather service returned ${response.status}.`);
  }

  return response.json();
}

async function findCity(city, signal) {
  const url = new URL(API_URLS.geocoding);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const data = await fetchJSON(url, signal);

  if (!data.results || data.results.length === 0) {
    throw new Error(
      "We couldn't find that city. Check the spelling and try again."
    );
  }

  return data.results[0];
}

async function getForecast(latitude, longitude, signal) {
  const url = new URL(API_URLS.forecast);
  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m"
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
  );
  url.searchParams.set("forecast_days", "6");
  url.searchParams.set("timezone", "auto");

  return fetchJSON(url, signal);
}

function formatDay(dateString, options) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(
    "en-US",
    options
  );
}

function renderWeather(city, data) {
  const current = data.current;
  const daily = data.daily;
  const [description, icon] = getWeather(current.weather_code);

  document.getElementById("city-name").textContent =
    `${city.name}, ${city.country}`;

  document.getElementById("current-date").textContent =
    formatDay(current.time.slice(0, 10), {
      weekday: "long",
      month: "long",
      day: "numeric"
    });

  document.getElementById("current-icon").textContent = icon;
  document.getElementById("temperature").textContent =
    `${Math.round(current.temperature_2m)}°`;

  document.getElementById("weather-description").textContent = description;
  document.getElementById("feels-like").textContent =
    `Feels like ${Math.round(current.apparent_temperature)}°C`;

  document.getElementById("humidity").textContent =
    `${current.relative_humidity_2m}%`;

  document.getElementById("wind-speed").textContent =
    `${Math.round(current.wind_speed_10m)} km/h`;

  document.getElementById("high-low").textContent =
    `${Math.round(daily.temperature_2m_max[0])}° / ${Math.round(daily.temperature_2m_min[0])}°`;

  // Display the next five days, excluding today.
  forecastList.replaceChildren();

  for (let i = 1; i <= 5; i++) {
    const [dayDescription, dayIcon] = getWeather(daily.weather_code[i]);

    const card = document.createElement("article");
    card.className = "forecast-day";

    const dayName = document.createElement("p");
    dayName.className = "forecast-name";
    dayName.textContent = formatDay(daily.time[i], {
      weekday: "short"
    });

    const iconElement = document.createElement("span");
    iconElement.className = "forecast-icon";
    iconElement.textContent = dayIcon;
    iconElement.setAttribute("role", "img");
    iconElement.setAttribute("aria-label", dayDescription);

    const temperatures = document.createElement("div");
    temperatures.className = "forecast-temps";

    const high = document.createElement("span");
    high.textContent = `${Math.round(daily.temperature_2m_max[i])}°`;

    const low = document.createElement("span");
    low.className = "forecast-low";
    low.textContent = `${Math.round(daily.temperature_2m_min[i])}°`;

    temperatures.append(high, low);

    const rain = document.createElement("p");
    rain.className = "forecast-rain";
    rain.textContent =
      `${daily.precipitation_probability_max?.[i] ?? 0}% rain`;

    card.append(dayName, iconElement, temperatures, rain);
    forecastList.appendChild(card);
  }

  weatherContent.hidden = false;
}

async function searchWeather(city) {
  const trimmedCity = city.trim();

  if (!trimmedCity) {
    showStatus("Please enter a city name.", "error");
    cityInput.focus();
    return;
  }

  if (trimmedCity.length < 2 || !/[\p{L}\p{N}]/u.test(trimmedCity)) {
    showStatus("Enter a valid city name with at least two characters.", "error");
    return;
  }

  if (!/^[\p{L}\p{M}\p{N} .,'’()-]+$/u.test(trimmedCity)) {
    showStatus("Please use a valid city name.", "error");
    return;
  }

  clearTimeout(suggestionTimer);
  suggestionController?.abort();

  searchButton.disabled = true;
  searchButton.textContent = "Loading...";
  showStatus(`Looking up weather for ${trimmedCity}...`);

  try {
    const cityResult = await findCity(trimmedCity);
    const weather = await getForecast(cityResult.latitude, cityResult.longitude);

    if (!weather.current || !weather.daily) {
      throw new Error("Weather data is incomplete. Please try again.");
    }

    renderWeather(cityResult, weather);
    showStatus(`Weather updated for ${cityResult.name}.`, "success");
  } catch (error) {
    if (error.name === "AbortError") return;

    if (error instanceof TypeError) {
      showStatus(
        "We couldn't connect to the weather service. Check your internet and try again.",
        "error"
      );
    } else {
      showStatus(
        error.message || "Something went wrong. Please try again.",
        "error"
      );
    }
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = 'Search <span>→</span>';
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchWeather(cityInput.value);
});

// Debounce lightweight city suggestions while the user types.
cityInput.addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  suggestionController?.abort();

  const query = cityInput.value.trim();

  if (query.length < 3) return;

  suggestionTimer = setTimeout(async () => {
    suggestionController = new AbortController();

    try {
      const url = new URL(API_URLS.geocoding);
      url.searchParams.set("name", query);
      url.searchParams.set("count", "1");
      url.searchParams.set("language", "en");
      url.searchParams.set("format", "json");

      const data = await fetchJSON(url, suggestionController.signal);

      // Helpful hint only; the user still submits the search.
      if (data.results?.length) {
        cityInput.setCustomValidity("");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.warn("City suggestion lookup unavailable:", error);
      }
    }
  }, 500);
});

// Start with an example city so the dashboard isn't empty.
searchWeather("Chennai");
