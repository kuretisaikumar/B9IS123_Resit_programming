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
                    <button onclick="deletePet(${pet.id})">Delete</button>
                    <button onclick="updatePetStatus(${pet.id}, 'Adopted')">Mark as Adopted</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading pets:', error);
        alert('Failed to load pets.');
    }
}

async function fetchWithAuth(url, options = {}) {
const token = localStorage.getItem('token');
if (!token) {
alert('You need to log in first.');
window.location.href = 'login.html';
return;
}
options.headers = {
...options.headers,
Authorization: `Bearer ${token}`, // Ensure the correct Bearer format
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


async function deletePet(petId) {
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

async function updatePetStatus(petId, status) {
    try {
        const result = await fetchWithAuth(`/update-pet/${petId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status }),
        });
        alert(result.message);
        loadPets();
    } catch (error) {
        console.error('Error updating pet status:', error);
        alert('Failed to update pet status.');
    }
}

document.getElementById('add-pet-form').addEventListener('submit', async (event) => {
    event.preventDefault();
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

loadPets();