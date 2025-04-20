let map;
let userMarker;
let reliefMarkers = [];
let currentLocation = null;

// Initialize the map
function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// Get user's location
async function getUserLocation() {
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        const { latitude, longitude } = position.coords;
        currentLocation = { lat: latitude, lng: longitude };
        
        // Update map view
        map.setView([latitude, longitude], 13);
        
        // Add or update user marker
        if (userMarker) {
            userMarker.setLatLng([latitude, longitude]);
        } else {
            userMarker = L.marker([latitude, longitude], {
                icon: L.divIcon({
                    className: 'user-marker',
                    html: '<i class="fas fa-user"></i>',
                    iconSize: [30, 30]
                })
            }).addTo(map);
        }
        
        // Fetch nearby relief centers
        fetchReliefCenters(latitude, longitude);
        
    } catch (error) {
        console.error('Error getting location:', error);
        showError('Unable to get your location. Please enable location services.');
    }
}

// Fetch relief centers from OpenStreetMap
async function fetchReliefCenters(lat, lng) {
    try {
        showLoading(true);
        
        // Clear existing markers
        reliefMarkers.forEach(marker => map.removeLayer(marker));
        reliefMarkers = [];
        
        // Query OpenStreetMap for emergency services
        const radius = 5000; // 5km radius
        const query = `
            [out:json][timeout:25];
            (
                node["amenity"="shelter"](around:${radius},${lat},${lng});
                node["emergency"="shelter"](around:${radius},${lat},${lng});
                node["amenity"="social_facility"]["social_facility"="shelter"](around:${radius},${lat},${lng});
            );
            out body;
            >;
            out skel qt;
        `;
        
        const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        // Process and display relief centers
        displayReliefCenters(data.elements);
        
    } catch (error) {
        console.error('Error fetching relief centers:', error);
        showError('Unable to fetch relief centers. Please try again later.');
    } finally {
        showLoading(false);
    }
}

// Display relief centers on map and list
function displayReliefCenters(centers) {
    const reliefList = document.getElementById('relief-centers');
    const selectedType = document.getElementById('relief-type').value;
    
    // Clear existing list
    reliefList.innerHTML = '';
    
    if (centers.length === 0) {
        reliefList.innerHTML = '<p class="no-centers">No relief centers found in your area.</p>';
        return;
    }
    
    centers.forEach(center => {
        if (center.tags) {
            const name = center.tags.name || 'Unnamed Center';
            const type = getReliefType(center.tags);
            
            if (selectedType === 'all' || selectedType === type) {
                // Add marker to map
                const marker = L.marker([center.lat, center.lon], {
                    icon: L.divIcon({
                        className: `relief-marker ${type}`,
                        html: `<i class="fas ${getReliefIcon(type)}"></i>`,
                        iconSize: [30, 30]
                    })
                }).addTo(map);
                
                marker.bindPopup(`
                    <h3>${name}</h3>
                    <p>Type: ${type.replace('_', ' ')}</p>
                    ${center.tags.phone ? `<p>Phone: ${center.tags.phone}</p>` : ''}
                    ${center.tags.website ? `<p><a href="${center.tags.website}" target="_blank">Website</a></p>` : ''}
                `);
                
                reliefMarkers.push(marker);
                
                // Add to list
                const centerElement = document.createElement('div');
                centerElement.className = 'relief-center';
                centerElement.innerHTML = `
                    <div class="center-icon ${type}">
                        <i class="fas ${getReliefIcon(type)}"></i>
                    </div>
                    <div class="center-info">
                        <h3>${name}</h3>
                        <p>Type: ${type.replace('_', ' ')}</p>
                        ${center.tags.phone ? `<p><i class="fas fa-phone"></i> ${center.tags.phone}</p>` : ''}
                        <button class="get-directions" onclick="getDirections(${center.lat}, ${center.lon})">
                            <i class="fas fa-directions"></i> Get Directions
                        </button>
                    </div>
                `;
                
                reliefList.appendChild(centerElement);
            }
        }
    });
}

// Get relief type from tags
function getReliefType(tags) {
    if (tags.emergency === 'shelter') return 'emergency';
    if (tags.social_facility === 'shelter') return 'shelter';
    return 'general';
}

// Get icon for relief type
function getReliefIcon(type) {
    const icons = {
        emergency: 'fa-hospital',
        shelter: 'fa-home',
        general: 'fa-building'
    };
    return icons[type] || 'fa-building';
}

// Get directions to relief center
function getDirections(lat, lng) {
    if (!currentLocation) {
        showError('Please enable location services to get directions.');
        return;
    }
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
}

// Show loading state
function showLoading(isLoading) {
    const reliefList = document.getElementById('relief-centers');
    if (isLoading) {
        reliefList.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading relief centers...</p>
            </div>
        `;
    }
}

// Show error message
function showError(message) {
    const reliefList = document.getElementById('relief-centers');
    reliefList.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            ${message}
        </div>
    `;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    
    document.getElementById('get-location').addEventListener('click', getUserLocation);
    document.getElementById('relief-type').addEventListener('change', () => {
        if (currentLocation) {
            fetchReliefCenters(currentLocation.lat, currentLocation.lng);
        }
    });
}); 