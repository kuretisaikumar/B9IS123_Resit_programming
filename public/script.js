// script.js
// Utility to get JWT token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Utility for authenticated API requests
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    if (!token) {
        alert('You need to log in first.');
        window.location.href = 'login.html';
        return;
    }
    options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`, // Ensure proper Bearer format
        'Content-Type': 'application/json',
    };

    const response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
        alert('Session expired. Please log in again.');
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return null; // Ensure no further execution with invalid token
    }

    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }

    return response.json();
}
