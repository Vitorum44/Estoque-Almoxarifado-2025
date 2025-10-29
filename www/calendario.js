document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('dateInput');
    const calendar = document.getElementById('calendar');

    dateInput.addEventListener('click', function() {
        calendar.classList.toggle('hidden');
    });

    // Aqui você pode adicionar lógica para selecionar uma data e fechar o calendário
});
