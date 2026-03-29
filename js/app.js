// --- Utilities ---

function escHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// --- Modal ---

function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML = bodyHtml
  document.getElementById('modal-overlay').classList.add('open')
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open')
}

// --- Header date ---

function setHeaderDate() {
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('es-ES', opts)
}

// --- Event listeners ---

document.getElementById('modal-close').addEventListener('click', closeModal)
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal()
})
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

document.querySelectorAll('[data-scope]').forEach(btn => {
  btn.addEventListener('click', () => openAddTask(btn.dataset.scope))
})

document.getElementById('btn-add-project').addEventListener('click', openAddProject)
document.getElementById('btn-add-event').addEventListener('click', openAddEvent)

// --- Init ---

setHeaderDate()
setupDropZones()
Promise.all([loadTasks(), loadProjects(), loadCalendar()])
