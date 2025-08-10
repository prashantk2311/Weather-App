// DOM Elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const themeBtn = document.getElementById('theme-btn');
const errorMessage = document.getElementById('error-message');
const suggestionsContainer = document.getElementById('suggestions-container');
const currentLocation = document.getElementById('current-location');
const currentDate = document.getElementById('current-date');
const temperatureElement = document.getElementById('temperature');
const weatherDescription = document.getElementById('weather-description');
const weatherIcon = document.getElementById('weather-icon');
const humidity = document.getElementById('humidity');
const wind = document.getElementById('wind');
const pressure = document.getElementById('pressure');
const sunrise = document.getElementById('sunrise');
const sunset = document.getElementById('sunset');
const forecastDays = document.getElementById('forecast-days');
const unitElements = document.querySelectorAll('.unit');
const mapBtn = document.getElementById('map-btn');
const currentYear = document.getElementById('current-year');

// API Key and Base URL
const API_KEY = '646805405dc4e293f2ca9508143c2346'; // Replace with your actual API key
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEOCODE_URL = 'https://api.openweathermap.org/geo/1.0';

// Global variables
let currentUnit = 'celsius';
let currentWeatherData = null;

// Initialize the app
function init() {
    // Set current year in footer
    currentYear.textContent = new Date().getFullYear();
    
    // Event listeners
    searchBtn.addEventListener('click', handleSearch);
    locationBtn.addEventListener('click', getLocationWeather);
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    cityInput.addEventListener('input', debounce(fetchSearchSuggestions, 300));
    themeBtn.addEventListener('click', toggleTheme);
    mapBtn.addEventListener('click', openMap);
    
    // Unit toggle
    unitElements.forEach(unit => {
        unit.addEventListener('click', () => {
            unitElements.forEach(u => u.classList.remove('active'));
            unit.classList.add('active');
            currentUnit = unit.dataset.unit;
            if (currentWeatherData) {
                updateWeatherDisplay(currentWeatherData);
            }
        });
    });
    
    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            suggestionsContainer.style.display = 'none';
        }
    });
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    // Load default weather (optional)
    fetchWeatherByCity('London');
}

// Handle search
async function handleSearch() {
    const city = cityInput.value.trim();
    
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    
    try {
        showLoading();
        clearError();
        
        // Clear previous weather data
        currentWeatherData = null;
        
        // Fetch weather data
        const weatherData = await fetchWeatherByCity(city);
        currentWeatherData = weatherData;
        
        // Update UI with new data
        updateWeatherDisplay(currentWeatherData);
        
    } catch (error) {
        console.error('Search Error:', error);
        showError(error.message || 'Failed to fetch weather data');
    } finally {
        hideLoading();
    }
}

async function fetchWeatherByCity(location) {
    try {
        // Fetch current weather
        const currentResponse = await fetch(
            `${BASE_URL}/weather?q=${encodeURIComponent(location)}&appid=${API_KEY}&units=metric`
        );
        
        if (!currentResponse.ok) {
            const errorData = await currentResponse.json();
            throw new Error(errorData.message || 'City not found');
        }
        
        const currentData = await currentResponse.json();
        
        // Fetch forecast using coordinates
        const forecastResponse = await fetch(
            `${BASE_URL}/forecast?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&appid=${API_KEY}&units=metric`
        );
        
        if (!forecastResponse.ok) {
            throw new Error('Failed to get forecast');
        }
        
        const forecastData = await forecastResponse.json();
        
        return {
            current: currentData,
            forecast: forecastData,
            location: {
                name: currentData.name,
                country: currentData.sys.country,
                coord: currentData.coord
            }
        };
        
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Unable to get weather data. Please try again.');
    }
}
// Get weather by geolocation
function getLocationWeather() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    
                    // Fetch reverse geocoding to get city name
                    const geoResponse = await fetch(
                        `${GEOCODE_URL}/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`
                    );
                    
                    if (!geoResponse.ok) {
                        throw new Error('Failed to get location name');
                    }
                    
                    const geoData = await geoResponse.json();
                    const cityName = geoData[0]?.name || 'Your Location';
                    const countryCode = geoData[0]?.country || '';
                    
                    // Fetch current weather
                    const currentResponse = await fetch(
                        `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`
                    );
                    const currentData = await currentResponse.json();
                    
                    // Fetch forecast
                    const forecastResponse = await fetch(
                        `${BASE_URL}/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`
                    );
                    const forecastData = await forecastResponse.json();
                    
                    currentWeatherData = {
                        current: currentData,
                        forecast: forecastData,
                        location: {
                            name: cityName,
                            country: countryCode,
                            coord: { lat: latitude, lon: longitude }
                        }
                    };
                    
                    updateWeatherDisplay(currentWeatherData);
                    cityInput.value = `${cityName}${countryCode ? ', ' + countryCode : ''}`;
                } catch (error) {
                    showError('Unable to fetch weather data for your location.');
                } finally {
                    hideLoading();
                }
            },
            (error) => {
                showError('Geolocation permission denied. Please enable it to use this feature.');
                hideLoading();
            }
        );
    } else {
        showError('Geolocation is not supported by your browser.');
    }
}

// Update weather display with fetched data
function updateWeatherDisplay(data) {
    const { current, forecast, location } = data;
    
    // Update location and date
    currentLocation.textContent = `${location.name}${location.country ? ', ' + location.country : ''}`;
    currentDate.textContent = formatDate(new Date(current.dt * 1000));
    
    // Update current weather
    const temp = currentUnit === 'celsius' ? current.main.temp : celsiusToFahrenheit(current.main.temp);
    temperatureElement.textContent = `${Math.round(temp)}°`;
    
    weatherDescription.textContent = current.weather[0].description;
    updateWeatherIcon(current.weather[0].id, current.weather[0].icon);
    
    humidity.textContent = `${current.main.humidity}%`;
    
    const windSpeed = currentUnit === 'celsius' ? current.wind.speed * 3.6 : current.wind.speed * 2.237;
    wind.textContent = `${Math.round(windSpeed)} ${currentUnit === 'celsius' ? 'km/h' : 'mph'}`;
    
    pressure.textContent = `${current.main.pressure} hPa`;
    
    const sunriseTime = new Date(current.sys.sunrise * 1000);
    sunrise.textContent = formatTime(sunriseTime);
    
    const sunsetTime = new Date(current.sys.sunset * 1000);
    sunset.textContent = formatTime(sunsetTime);
    
    // Update forecast
    updateForecastDisplay(forecast);
}

// Update forecast display
function updateForecastDisplay(forecastData) {
    forecastDays.innerHTML = '';
    
    // Group forecast by day
    const dailyForecast = {};
    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        if (!dailyForecast[day]) {
            dailyForecast[day] = {
                temps: [],
                weatherIds: [],
                icons: [],
                dates: []
            };
        }
        
        dailyForecast[day].temps.push(item.main.temp);
        dailyForecast[day].weatherIds.push(item.weather[0].id);
        dailyForecast[day].icons.push(item.weather[0].icon);
        dailyForecast[day].dates.push(date);
    });
    
    // Display forecast for next 5 days
    const days = Object.keys(dailyForecast).slice(0, 5);
    days.forEach(day => {
        const dayData = dailyForecast[day];
        const maxTemp = Math.max(...dayData.temps);
        const minTemp = Math.min(...dayData.temps);
        
        // Find most common weather condition for the day
        const weatherCounts = {};
        dayData.weatherIds.forEach(id => {
            weatherCounts[id] = (weatherCounts[id] || 0) + 1;
        });
        const mostCommonWeatherId = Object.keys(weatherCounts).reduce((a, b) => 
            weatherCounts[a] > weatherCounts[b] ? a : b
        );
        const mostCommonIcon = dayData.icons[dayData.weatherIds.indexOf(mostCommonWeatherId)];
        
        // Find date for this day
        const dayDate = dayData.dates[0];
        const dateStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const forecastDayElement = document.createElement('div');
        forecastDayElement.className = 'forecast-day';
        
        const displayMaxTemp = currentUnit === 'celsius' ? maxTemp : celsiusToFahrenheit(maxTemp);
        const displayMinTemp = currentUnit === 'celsius' ? minTemp : celsiusToFahrenheit(minTemp);
        
        forecastDayElement.innerHTML = `
            <div class="day-name">${day}</div>
            <div class="forecast-date">${dateStr}</div>
            <div class="forecast-icon">
                <i class="wi ${getWeatherIcon(mostCommonWeatherId, mostCommonIcon)}"></i>
            </div>
            <div class="forecast-temp">
                <span class="max-temp">${Math.round(displayMaxTemp)}°</span>
                <span class="min-temp">${Math.round(displayMinTemp)}°</span>
            </div>
        `;
        
        forecastDays.appendChild(forecastDayElement);
    });
}

// Fetch search suggestions
async function fetchSearchSuggestions() {
    const query = cityInput.value.trim();
    if (query.length < 2) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(
            `${GEOCODE_URL}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch suggestions');
        }
        
        const data = await response.json();
        showSuggestions(data);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        suggestionsContainer.style.display = 'none';
    }
}

// Show search suggestions
function showSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    suggestionsContainer.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        
        let suggestionText = suggestion.name;
        if (suggestion.state) suggestionText += `, ${suggestion.state}`;
        if (suggestion.country) suggestionText += `, ${suggestion.country}`;
        
        suggestionItem.textContent = suggestionText;
        
        suggestionItem.addEventListener('click', () => {
            cityInput.value = suggestionText;
            suggestionsContainer.style.display = 'none';
            handleSearch();
        });
        
        suggestionsContainer.appendChild(suggestionItem);
    });
    
    suggestionsContainer.style.display = 'block';
}

// Open map for current location
function openMap() {
    if (!currentWeatherData) return;
    
    const { lat, lon } = currentWeatherData.location.coord;
    const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`;
    window.open(mapUrl, '_blank');
}

// Save recent search to localStorage
function saveRecentSearch(location) {
    const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    if (!searches.includes(location)) {
        searches.unshift(location);
        localStorage.setItem('recentSearches', JSON.stringify(searches.slice(0, 5)));
    }
}

// Update weather icon based on weather code
function updateWeatherIcon(weatherCode, iconCode) {
    const iconClass = getWeatherIcon(weatherCode, iconCode);
    weatherIcon.innerHTML = `<i class="wi ${iconClass}"></i>`;
}

// Get appropriate weather icon class
function getWeatherIcon(weatherCode, iconCode) {
    // First check if we have valid parameters
    if (typeof weatherCode === 'undefined' || typeof iconCode === 'undefined') {
        console.warn('Missing weather code or icon code');
        return 'wi-day-sunny'; // default icon
    }

    const code = Math.floor(weatherCode / 100);
    const isNight = iconCode ? iconCode.includes('n') : false;
    
    if (weatherCode === 800) {
        return isNight ? 'wi-night-clear' : 'wi-day-sunny';
    }
    
    switch(code) {
        case 2: return 'wi-thunderstorm';
        case 3: return isNight ? 'wi-night-alt-rain' : 'wi-day-rain';
        case 5: return isNight ? 'wi-night-alt-rain' : 'wi-day-rain';
        case 6: return isNight ? 'wi-night-alt-snow' : 'wi-day-snow';
        case 7: return 'wi-fog';
        case 8: return isNight ? 'wi-night-alt-cloudy' : 'wi-day-cloudy';
        default: return isNight ? 'wi-night-clear' : 'wi-day-sunny';
    }
}

// Convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
}

// Format date to "Weekday, Month Day"
function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Format time to HH:MM
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Toggle between dark and light theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

// Update theme icon based on current theme
function updateThemeIcon(theme) {
    const icon = themeBtn.querySelector('i');
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Clear error message
function clearError() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
}

// Show loading state
function showLoading() {
    searchBtn.innerHTML = '<div class="loading"></div>';
    searchBtn.disabled = true;
}

// Hide loading state
function hideLoading() {
    searchBtn.innerHTML = '<i class="fas fa-search"></i>';
    searchBtn.disabled = false;
}

// Debounce function for search suggestions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);