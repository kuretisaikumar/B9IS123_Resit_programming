async function loadPets() {
    const response = await fetch('/api/pets');
    const pets = await response.json();
    const table = document.getElementById('petsTable');
    pets.forEach(pet => {
        const row = table.insertRow();
        row.innerHTML = `<td>${pet.id}</td><td>${pet.name}</td><td>${pet.age}</td><td>${pet.breed}</td><td>${pet.status}</td><td>${pet.description}</td>`;
    });
}

loadPets();
