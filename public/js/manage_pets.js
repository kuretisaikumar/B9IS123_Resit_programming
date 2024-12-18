// Utility to get the role from localStorage
function getRole() {
    return localStorage.getItem('role'); // Assuming role is stored in localStorage after login
}

// Utility to check if the user is an admin
function isAdmin() {
    return getRole() === 'admin';
}

// Function to load pets from the server
async function loadPets() {
    try {
        const response = await fetch('/pets', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('Failed to fetch pets');
        }
        const pets = await response.json();
        const tableBody = document.querySelector('#pets-table tbody');
        tableBody.innerHTML = '';
        pets.forEach(pet => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${pet.image || 'images/placeholder.jpg'}" alt="${pet.name}"></td>
                <td>${pet.name}</td>
                <td>${pet.breed}</td>
                <td>${pet.age}</td>
                <td>${pet.status}</td>
                <td>
                    ${isAdmin() ? `<button onclick="deletePet(${pet.id})">Delete</button>` : ''}
                    ${isAdmin() ? `<button onclick="updatePetStatus(${pet.id}, 'Adopted')">Mark as Adopted</button>` : ''}
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading pets:', error);
        alert('Failed to load pets.');
    }
}

// Utility function for authenticated API requests
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('You need to log in first.');
        window.location.href = 'login.html';
        return;
    }

    options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`, // Ensure correct Bearer format
        'Content-Type': 'application/json',
    };

    const response = await fetch(url, options);
    
    if (response.status === 403) {
        alert('You do not have permission to perform this action.');
        throw new Error('Forbidden');
    }
    
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    
    return response.json();
}

// Function to delete a pet (admin only)
async function deletePet(petId) {
    if (!isAdmin()) {
        alert('You do not have permission to perform this action.');
        return;
    }
    try {
        const result = await fetchWithAuth(`/delete-pet/${petId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        alert(result.message);
        loadPets();
    } catch (error) {
        console.error('Error deleting pet:', error);
        alert('Failed to delete pet.');
    }
}

// Function to update a pet's status (admin only)
async function updatePetStatus(petId, status) {
    if (!isAdmin()) {
        alert('You do not have permission to perform this action.');
        return;
    }

    if (status !== 'Adopted') {
        alert('Invalid status update. Only "Adopted" is allowed.');
        return;
    }

    try {
        const result = await fetchWithAuth(`/pets/${petId}/adopt`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (result.message) {
            alert(result.message);
        }

        loadPets(); // Reload the pet list after updating the status
    } catch (error) {
        console.error('Error updating pet status:', error);
        alert('Failed to update pet status.');
    }
}

// Add pet (admin only)
document.getElementById('add-pet-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin()) {
        alert('You do not have permission to perform this action.');
        return;
    }
    try {
        const formData = new FormData(event.target);
        const result = await fetchWithAuth('/add-pet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(Object.fromEntries(formData)),
        });
        alert(result.message);
        loadPets();
    } catch (error) {
        console.error('Error adding pet:', error);
        alert('Failed to add pet.');
    }
});

// Load pets when the page loads
loadPets();
