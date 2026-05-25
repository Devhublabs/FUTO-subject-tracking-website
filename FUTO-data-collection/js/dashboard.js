const toggle = document.getElementById('tier-toggle');
const tierContent = document.getElementById('tier-content');
const FAB = document.getElementById('fab-upload')

toggle.addEventListener('click', () => {
  tierContent.classList.toggle('hidden');
  toggle.textContent = tierContent.classList.contains('hidden') ? 'Show' : 'Hide';
});

