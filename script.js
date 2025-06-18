async function getWeather() {
    const city = document.getElementById("city-input").value;
    if (!city) {
        showError("Please enter a city name");
        return;
    }

    const apiKey = "32c1246f90ac6e9b52b981203148a1ec";
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    try {
        // Show loading state
        showLoading(true);

        // First get location coordinates using Geocoding API
        const geoData = await fetchWithRetry(
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`,
            maxRetries,
            retryDelay
        );
        
        if (geoData.length === 0) {
            throw new Error("Location not found. Please try a nearby city or check the spelling.");
        }

        const { lat, lon, name: locationName, state, country } = geoData[0];
        const displayName = state ? `${locationName}, ${state}, ${country}` : `${locationName}, ${country}`;
        
        // Then get weather data using coordinates
        const weatherData = await fetchWithRetry(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
            maxRetries,
            retryDelay
        );
        
        // Get AQI data using coordinates
        const aqiData = await fetchWithRetry(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`,
            maxRetries,
            retryDelay
        );

        // Update UI with the fetched data
        updateWeatherUI(weatherData, aqiData, displayName);
        
    } catch (error) {
        handleError(error);
    } finally {
        showLoading(false);
    }
}

async function fetchWithRetry(url, maxRetries, retryDelay) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    
    throw lastError;
}

function showLoading(isLoading) {
    const searchButton = document.querySelector('.search-container button');
    const weatherInfo = document.getElementById("weather-info");
    
    if (isLoading) {
        searchButton.disabled = true;
        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        weatherInfo.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    } else {
        searchButton.disabled = false;
        searchButton.innerHTML = 'Get Weather';
    }
}

function showError(message) {
    const weatherInfo = document.getElementById("weather-info");
    weatherInfo.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            ${message}
        </div>
    `;
    
    // Reset all tabs to initial state
    resetAllTabs();
}

function handleError(error) {
    console.error('Error:', error);
    
    let userMessage = "An error occurred while fetching weather data.";
    
    if (error.message.includes("404")) {
        userMessage = "Location not found. Please check the city name and try again.";
    } else if (error.message.includes("401")) {
        userMessage = "API authentication error. Please contact support.";
    } else if (error.message.includes("429")) {
        userMessage = "Too many requests. Please try again later.";
    } else if (error.message.includes("network")) {
        userMessage = "Network error. Please check your internet connection.";
    } else if (error.message) {
        userMessage = error.message;
    }
    
    showError(userMessage);
}

function resetAllTabs() {
    document.querySelector('.aqi-value').textContent = 'AQI: --';
    document.querySelector('#aqi p').textContent = 'Enter a city name to see air quality data';
    document.querySelector('.driving-info').innerHTML = '<p>Enter a city name to see driving conditions</p>';
    document.querySelector('.food-suggestions').innerHTML = '<p>Enter a city name to get food suggestions based on weather</p>';
    document.querySelector('.outfit-suggestions').innerHTML = '<p>Enter a city name to get outfit suggestions based on weather</p>';
    document.querySelector('.music-suggestions').innerHTML = '<p>Enter a city name to get music suggestions based on weather</p>';
}

function updateWeatherUI(weatherData, aqiData, displayName) {
    const weatherIcon = getWeatherIcon(weatherData.weather[0].main, weatherData.weather[0].description);
    let warningMessage = '';
  
    // Add warning for thunderstorm conditions
    if (weatherData.weather[0].main === 'Thunderstorm' || weatherData.weather[0].description.includes('thunder')) {
        warningMessage = `
            <div class="weather-warning thunder-warning">
                ⚡ WARNING: Thunderstorm detected! Stay indoors and away from windows.
                Avoid using electrical equipment and unplug sensitive devices.
            </div>
        `;
    }

    // Add warning for extreme heat conditions
    if (weatherData.main.temp >= 40) {
        warningMessage += `
            <div class="weather-warning heat-warning">
                🌡️ EXTREME HEAT WARNING! Temperature above 40°C.
                Risk of heatstroke! Stay hydrated, avoid outdoor activities,
                and stay in cool, shaded areas.
            </div>
        `;
    }
  
    const weatherInfo = `
        <div class="weather-icon">
            <img src="./${weatherIcon}" alt="Weather Icon" id="weather-icon-img">
        </div>
        ${warningMessage}
        <h3>Weather in ${displayName}</h3>
        <p>Temperature: ${weatherData.main.temp}°C</p>
        <p>Condition: ${weatherData.weather[0].description}</p>
        <p>Humidity: ${weatherData.main.humidity}%</p>
        <p>Wind Speed: ${weatherData.wind.speed} m/s</p>
    `;
    document.getElementById("weather-info").innerHTML = weatherInfo;

    // Update AQI info
    const aqiValue = aqiData.list[0].main.aqi;
    const aqiDescription = getAQIDescription(aqiValue);
    const aqiColor = getAQIColor(aqiValue);
  
    document.querySelector('.aqi-value').textContent = `AQI: ${aqiValue}`;
    document.querySelector('.aqi-value').style.color = aqiColor;
    document.querySelector('#aqi p').textContent = aqiDescription;

    // Update all other tabs
    try {
        updateDrivingConditions(weatherData);
        updateFoodSuggestions(weatherData);
        updateOutfitSuggestions(weatherData);
        updateMusicSuggestions(weatherData);
    } catch (tabError) {
        console.error("Error updating tabs:", tabError);
        showError("Error updating some features. Please try again.");
    }
}

function getWeatherIcon(weatherMain, weatherDesc) {
    const icons = {
        'Clear': 'sunny.gif',
        'Clouds': 'cloudy.png',
        'Rain': 'rainy.gif',
        'Drizzle': 'drizzle.gif',
        'Thunderstorm': 'thunderstorm.png',
        'Snow': 'snowy.gif',
        'Mist': 'misty.png',
        'Fog': 'foggy.png'
    };

    // Check for specific weather descriptions
    if (weatherDesc.includes('thunderstorm')) return 'thunderstorm.png';
    if (weatherDesc.includes('drizzle')) return 'drizzle.gif';
    if (weatherDesc.includes('snow')) return 'snowy.gif';
    if (weatherDesc.includes('mist') || weatherDesc.includes('fog')) return 'misty.png';
    
    return icons[weatherMain] || 'weather-default.png';
}

function updateDrivingConditions(weatherData) {
    const temp = weatherData.main.temp;
    const weather = weatherData.weather[0].main.toLowerCase();
    const windSpeed = weatherData.wind.speed;
    const humidity = weatherData.main.humidity;

    let roadConditions = "Clear";
    let visibility = "Good";
    let traffic = "Normal";
    let recommendedSpeed = "Normal";
    let warnings = [];

    // Temperature-based conditions
    if (temp <= 0) {
        roadConditions = "Potentially Icy";
        warnings.push("Watch out for black ice");
        recommendedSpeed = "Reduced";
    } else if (temp >= 35) {
        warnings.push("Hot road surface may affect tire pressure");
    }

    // Weather-based conditions
    if (weather.includes("rain")) {
        roadConditions = "Wet";
        visibility = "Reduced";
        warnings.push("Wet roads - maintain safe distance");
    } else if (weather.includes("snow")) {
        roadConditions = "Snowy";
        visibility = "Poor";
        warnings.push("Snow accumulation on roads");
    }

    // Wind-based conditions
    if (windSpeed > 10) {
        visibility = "Reduced";
        warnings.push("Strong winds may affect vehicle stability");
    }

    // Humidity-based conditions
    if (humidity > 80) {
        warnings.push("High humidity may cause fog");
    }

    const drivingInfo = `
        <p><strong>Road Conditions:</strong> ${roadConditions}</p>
        <p><strong>Visibility:</strong> ${visibility}</p>
        <p><strong>Traffic:</strong> ${traffic}</p>
        <p><strong>Recommended Speed:</strong> ${recommendedSpeed}</p>
        ${warnings.length > 0 ? `<p><strong>Warnings:</strong></p><ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
    `;
    document.querySelector('.driving-info').innerHTML = drivingInfo;
}

function updateFoodSuggestions(weatherData) {
    const temp = weatherData.main.temp;
    const weather = weatherData.weather[0].main.toLowerCase();
    const humidity = weatherData.main.humidity;

    let suggestions = [];

    // Temperature-based suggestions
    if (temp <= 10) {
        suggestions.push("Hot soups and stews");
        suggestions.push("Warm beverages like tea or coffee");
        suggestions.push("Hearty meals with root vegetables");
    } else if (temp >= 30) {
        suggestions.push("Fresh salads and fruits");
        suggestions.push("Cold beverages and smoothies");
        suggestions.push("Light, refreshing meals");
    } else {
        // Normal temperature conditions (10-30°C)
        suggestions.push("Grilled meats and vegetables");
        suggestions.push("Fresh pasta dishes");
        suggestions.push("Seasonal fruits and vegetables");
        suggestions.push("Light sandwiches and wraps");
        suggestions.push("Fresh juices and water");
    }

    // Weather-based suggestions
    if (weather.includes("rain")) {
        suggestions.push("Comfort foods like pasta or curry");
        suggestions.push("Warm beverages");
    } else if (weather.includes("snow")) {
        suggestions.push("Hot chocolate and warm snacks");
        suggestions.push("Hearty winter meals");
    } else if (weather.includes("clear")) {
        suggestions.push("Outdoor picnic foods");
        suggestions.push("BBQ items");
        suggestions.push("Fresh fruit platters");
    }

    // Humidity-based suggestions
    if (humidity > 70) {
        suggestions.push("Hydrating foods like watermelon");
        suggestions.push("Light, non-greasy meals");
    }

    const foodInfo = `
        <p><strong>Perfect weather for:</strong></p>
        <ul>${suggestions.map(food => `<li>${food}</li>`).join('')}</ul>
    `;
    document.querySelector('.food-suggestions').innerHTML = foodInfo;
}

function updateOutfitSuggestions(weatherData) {
    const temp = weatherData.main.temp;
    const weather = weatherData.weather[0].main.toLowerCase();
    const windSpeed = weatherData.wind.speed;
    const humidity = weatherData.main.humidity;

    let suggestions = [];

    // Temperature-based suggestions
    if (temp <= 10) {
        suggestions.push("Warm winter coat or jacket");
        suggestions.push("Thermal layers");
        suggestions.push("Warm boots and gloves");
    } else if (temp >= 30) {
        suggestions.push("Light, breathable clothing");
        suggestions.push("Sun hat and sunglasses");
        suggestions.push("Light-colored clothes to reflect heat");
    } else {
        // Normal temperature conditions (10-30°C)
        suggestions.push("Light jacket or cardigan");
        suggestions.push("Comfortable jeans or casual pants");
        suggestions.push("Breathable cotton shirts");
        suggestions.push("Comfortable walking shoes");
        suggestions.push("Light scarf for layering");
    }

    // Weather-based suggestions
    if (weather.includes("rain")) {
        suggestions.push("Waterproof jacket or umbrella");
        suggestions.push("Water-resistant shoes");
    } else if (weather.includes("snow")) {
        suggestions.push("Snow boots");
        suggestions.push("Winter gloves and scarf");
    } else if (weather.includes("clear")) {
        suggestions.push("Sunglasses");
        suggestions.push("Light hat for sun protection");
        suggestions.push("Breathable fabrics");
    }

    // Wind-based suggestions
    if (windSpeed > 10) {
        suggestions.push("Wind-resistant outer layer");
    }

    // Humidity-based suggestions
    if (humidity > 70) {
        suggestions.push("Breathable, moisture-wicking fabrics");
    }

    const outfitInfo = `
        <p><strong>Recommended attire:</strong></p>
        <ul>${suggestions.map(item => `<li>${item}</li>`).join('')}</ul>
    `;
    document.querySelector('.outfit-suggestions').innerHTML = outfitInfo;
}

function updateMusicSuggestions(weatherData) {
  const weatherCondition = weatherData.weather[0].main.toLowerCase();
  const weatherMessage = document.querySelector('.weather-message');
  
  // Update weather message
  weatherMessage.textContent = `Create and manage your ${weatherCondition} day playlists`;
}

// Add event listeners for the playlist buttons
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('create-playlist').addEventListener('click', () => {
    window.open('https://soundcloud.com/you/library', '_blank');
  });
  
  document.getElementById('view-saved').addEventListener('click', () => {
    window.open('https://soundcloud.com/you/sets', '_blank');
  });
});

function getAQIDescription(aqi) {
    const descriptions = {
        1: "Good air quality. Perfect for outdoor activities.",
        2: "Fair air quality. Generally acceptable for most activities.",
        3: "Moderate air quality. Sensitive individuals should consider limiting outdoor activities.",
        4: "Poor air quality. Everyone should limit outdoor activities.",
        5: "Very poor air quality. Avoid outdoor activities."
    };
    return descriptions[aqi] || "Air quality data unavailable";
}

function getAQIColor(aqi) {
    const colors = {
        1: "#00C853", // Green
        2: "#FFD600", // Yellow
        3: "#FF9800", // Orange
        4: "#F44336", // Red
        5: "#9C27B0"  // Purple
    };
    return colors[aqi] || "#000000";
}

function openTab(evt, tabName) {
  // Get all tab content elements
  let tabContents = document.getElementsByClassName("tab-content");
  for (let i = 0; i < tabContents.length; i++) {
    tabContents[i].classList.remove("active");
  }

  // Get all tab buttons
  let tabButtons = document.getElementsByClassName("tab-button");
  for (let i = 0; i < tabButtons.length; i++) {
    tabButtons[i].classList.remove("active");
  }

  // Show the selected tab content and mark the button as active
  document.getElementById(tabName).classList.add("active");
  evt.currentTarget.classList.add("active");
}

// Add event listener for Enter key
document.getElementById("city-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Prevent form submission
        getWeather();
    }
});

async function getMyLocation() {
    try {
        // Show loading state
        document.getElementById("weather-info").innerHTML = '<p>Getting your precise location...</p>';
        
        // Request location permission with high accuracy settings
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser"));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000, // Increased timeout to 10 seconds
                maximumAge: 0
            });
        });

        // Get city name from coordinates using reverse geocoding with more precise parameters
        const apiKey = "32c1246f90ac6e9b52b981203148a1ec";
        const { latitude, longitude } = position.coords;
        const reverseGeocodeUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=5&appid=${apiKey}`;
        
        const response = await fetch(reverseGeocodeUrl);
        if (!response.ok) throw new Error("Failed to get location details");
        
        const data = await response.json();
        if (!data || data.length === 0) throw new Error("Location not found");

        // Find the most accurate city name
        let cityName = data[0].name;
        let state = data[0].state;
        let country = data[0].country;

        // If we have state information, include it for more accuracy
        if (state) {
            cityName = `${cityName}, ${state}`;
        }

        // Set the city name in the input field
        document.getElementById("city-input").value = cityName;
        
        // Show the full location details
        document.getElementById("weather-info").innerHTML = `
            <p>Location found: ${cityName}, ${country}</p>
            <p>Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
        `;
        
        // Get weather for the location
        await getWeather();
        
    } catch (error) {
        let errorMessage = "Unable to get your location.";
        if (error.code === 1) {
            errorMessage = "Location access denied. Please enable location services in your browser settings.";
        } else if (error.code === 2) {
            errorMessage = "Location unavailable. Please try again.";
        } else if (error.code === 3) {
            errorMessage = "Location request timed out. Please try again.";
        }
        
        document.getElementById("weather-info").innerHTML = `<p>${errorMessage}</p>`;
        document.getElementById("city-input").value = "";
    }
}
