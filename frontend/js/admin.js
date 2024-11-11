async function addPet() {
    const name = document.getElementById('petName').value;
    const age = document.getElementById('petAge').value;
    const breed = document.getElementById('petBreed').value;
    const status = document.getElementById('petStatus').value;
    const description = document.getElementById('petDescription').value;

    await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age, breed, status, description })
    });
    loadAdminPets();
}

async function loadAdminPets() {
    const response = await fetch('/api/pets');
    const pets = await response.json();
    const table = document.getElementById('adminPetsTable');
    pets.forEach(pet => {
        const row = table.insertRow();
        row.innerHTML = `<td>${pet.id}</td><td>${pet.name}</td><td>${pet.age}</td><td>${pet.breed}</td><td>${pet.status}</td><td>${pet.description}</td>
        <td><button onclick="deletePet(${pet.id})">Delete</button></td>`;
    });
}