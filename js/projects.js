let allProjects = []
let projectContacts = {}
let projectTasks = {}
const notesDebounce = {}
let dragProjectId = null
let showAllProjects = false
const PROJECTS_LIMIT = 10

const STATUS_CYCLE  = ['activo', 'pausa', 'descartado', 'completado']
const STATUS_LABEL  = { activo: 'Activo', pausa: 'En espera', descartado: 'Descartado', completado: 'Completado' }
const STATUS_CLASS  = { activo: 'proj-status-activo', pausa: 'proj-status-pausa', descartado: 'proj-status-descartado', completado: 'proj-status-completado' }

// ── LOAD ──────────────────────────────────────────────────

async function loadProjects() {
  const [{ data: projects, error: pe }, { data: contacts, error: ce }] = await Promise.all([
    db.from('projects').select('*').order('position'),
    db.from('project_contacts').select('*').order('date', { ascending: false })
  ])
  if (pe) { console.error(pe); return }
  if (ce) { console.error(ce); return }

  allProjects = projects || []
  projectContacts = {}
  ;(contacts || []).forEach(c => {
    if (!projectContacts[c.project_id]) projectContacts[c.project_id] = []
    projectContacts[c.project_id].push(c)
  })
  renderProjects()
}

// ── RENDER ─────────────────────────────────────────────────

function renderProjects() {
  projectTasks = {}
  allTasks.forEach(t => {
    if (t.project_id) {
      if (!projectTasks[t.project_id]) projectTasks[t.project_id] = []
      projectTasks[t.project_id].push(t)
    }
  })
  const list = document.getElementById('projects-list')
  const moreEl = document.getElementById('projects-more')
  if (!list) return

  const hasMore = allProjects.length > PROJECTS_LIMIT
  const visible = (hasMore && !showAllProjects) ? allProjects.slice(0, PROJECTS_LIMIT) : allProjects
  list.innerHTML = visible.map(p => projectCardHTML(p)).join('')

  if (moreEl) {
    if (hasMore) {
      moreEl.innerHTML = `<button class="btn-projects-more" onclick="toggleShowAllProjects()">
        ${showAllProjects ? 'Ver menos ▲' : `Ver más · ${allProjects.length - PROJECTS_LIMIT} proyectos más ▼`}
      </button>`
    } else {
      moreEl.innerHTML = ''
    }
  }
}

function toggleShowAllProjects() {
  showAllProjects = !showAllProjects
  renderProjects()
}

function projectCardHTML(p) {
  const tasks = (projectTasks[p.id] || []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const contacts = projectContacts[p.id] || []
  const status = p.status || 'activo'

  const tasksHTML = tasks.length
    ? tasks.map(t => `
      <li class="task-item ${t.done ? 'done' : ''}">
        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleProjectTask('${t.id}', this.checked)">
        <span class="task-text">${escHtml(t.title)}</span>
        <span class="task-actions">
          <button class="btn-icon btn-edit" onclick="openEditProjectTask('${t.id}')" title="Editar">✎</button>
          <button class="btn-icon" onclick="deleteProjectTask('${t.id}')" title="Borrar">✕</button>
        </span>
      </li>`).join('')
    : '<li class="empty">Sin tareas</li>'

  const contactsHTML = contacts.map(c => `
    <li class="proj-contact-item">
      <span class="proj-contact-date">${formatDate(c.date)}</span>
      <span class="proj-contact-subject">${escHtml(c.subject)}</span>
      <button class="btn-icon" onclick="deleteProjectContact('${c.id}','${p.id}')" title="Borrar">✕</button>
    </li>`).join('')

  return `
    <div class="project-card" data-id="${p.id}"
      draggable="true"
      ondragstart="onProjectDragStart(event,'${p.id}')"
      ondragend="onProjectDragEnd(event)"
      ondragover="onProjectDragOver(event,'${p.id}')"
      ondragleave="onProjectDragLeave(event)"
      ondrop="onProjectDrop(event,'${p.id}')">

      <div class="proj-col proj-col-info">
        <span class="project-name">${escHtml(p.name)}</span>
        ${p.subtitle ? `<span class="project-subtitle">${escHtml(p.subtitle)}</span>` : ''}
        ${p.client ? `<span class="project-client"><span class="proj-meta-label">Cliente:</span> ${escHtml(p.client)}</span>` : ''}
        <span class="project-entry-date">Entrada: ${formatDate(p.entry_date)}</span>
        <div class="project-card-btns">
          <button class="btn-icon btn-edit" onclick="openEditProject('${p.id}')" title="Editar">✎</button>
          <button class="btn-icon" onclick="confirmDeleteProject('${p.id}')" title="Borrar">✕</button>
        </div>
      </div>

      <div class="proj-col proj-col-status">
        <div class="proj-section-label">Estado</div>
        <span class="proj-status ${STATUS_CLASS[status]}"
          ondblclick="cycleProjectStatus('${p.id}')"
          title="Doble clic para cambiar estado">${STATUS_LABEL[status]}</span>
      </div>

      <div class="proj-col">
        <div class="proj-section-label">Contactos</div>
        <ul class="proj-contacts-list">${contactsHTML}</ul>
        <button class="btn-add-inline" onclick="openAddProjectContact('${p.id}')">+ Añadir contacto</button>
      </div>

      <div class="proj-col">
        <div class="proj-section-label">Notas</div>
        <textarea class="proj-notes" placeholder="Notas libres..."
          oninput="scheduleNoteSave('${p.id}', this.value)"
        >${escHtml(p.notes || '')}</textarea>
      </div>

      <div class="proj-col proj-col-tasks">
        <div class="proj-section-label">Tareas</div>
        <ul class="task-list">${tasksHTML}</ul>
        <button class="btn-add-inline" onclick="openAddProjectTask('${p.id}')">+ Añadir tarea</button>
      </div>
    </div>`
}

// ── ADD / EDIT / DELETE PROJECT ───────────────────────────

function openAddProject() {
  openModal('Nuevo proyecto', `
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="proj-name" placeholder="Nombre del proyecto">
    </div>
    <div class="form-group">
      <label>Descripción</label>
      <input type="text" id="proj-subtitle" placeholder="Tipo de obra, descripción…">
    </div>
    <div class="form-group">
      <label>Cliente</label>
      <input type="text" id="proj-client" placeholder="Nombre del cliente">
    </div>
    <div class="form-group">
      <label>Fecha de entrada</label>
      <input type="date" id="proj-date" value="${TODAY}">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveProject()">Guardar</button>
    </div>
  `)
  setTimeout(() => document.getElementById('proj-name')?.focus(), 50)
}

async function saveProject() {
  const name = document.getElementById('proj-name')?.value?.trim()
  const subtitle = document.getElementById('proj-subtitle')?.value?.trim() || ''
  const client = document.getElementById('proj-client')?.value?.trim() || ''
  const entry_date = document.getElementById('proj-date')?.value
  if (!name || !entry_date) return
  const position = allProjects.length
  const { data, error } = await db.from('projects').insert({ name, subtitle, client, entry_date, notes: '', status: 'activo', position }).select().single()
  if (error) { console.error(error); return }
  allProjects.push(data)
  projectContacts[data.id] = []
  renderProjects()
  closeModal()
}

function openEditProject(id) {
  const p = allProjects.find(p => p.id === id)
  if (!p) return
  openModal('Editar proyecto', `
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="proj-edit-name" value="${escHtml(p.name)}">
    </div>
    <div class="form-group">
      <label>Descripción</label>
      <input type="text" id="proj-edit-subtitle" value="${escHtml(p.subtitle || '')}">
    </div>
    <div class="form-group">
      <label>Cliente</label>
      <input type="text" id="proj-edit-client" value="${escHtml(p.client || '')}">
    </div>
    <div class="form-group">
      <label>Fecha de entrada</label>
      <input type="date" id="proj-edit-date" value="${p.entry_date}">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEditProject('${id}')">Guardar</button>
    </div>
  `)
  setTimeout(() => { const i = document.getElementById('proj-edit-name'); if (i) { i.focus(); i.select() } }, 50)
}

async function saveEditProject(id) {
  const name = document.getElementById('proj-edit-name')?.value?.trim()
  const subtitle = document.getElementById('proj-edit-subtitle')?.value?.trim() || ''
  const client = document.getElementById('proj-edit-client')?.value?.trim() || ''
  const entry_date = document.getElementById('proj-edit-date')?.value
  if (!name || !entry_date) return
  await db.from('projects').update({ name, subtitle, client, entry_date }).eq('id', id)
  const p = allProjects.find(p => p.id === id)
  if (p) { p.name = name; p.subtitle = subtitle; p.client = client; p.entry_date = entry_date }
  renderProjects()
  closeModal()
}

async function confirmDeleteProject(id) {
  if (!confirm('¿Borrar este proyecto? Las tareas asociadas quedarán en "Todas" sin proyecto.')) return
  await db.from('tasks').update({ project_id: null }).eq('project_id', id)
  allTasks.forEach(t => { if (t.project_id === id) t.project_id = null })
  await db.from('projects').delete().eq('id', id)
  allProjects = allProjects.filter(p => p.id !== id)
  delete projectContacts[id]
  renderProjects()
}

// ── PROJECT CONTACTS ──────────────────────────────────────

function openAddProjectContact(projectId) {
  openModal('Añadir contacto', `
    <div class="form-group">
      <label>Fecha</label>
      <input type="date" id="pc-date" value="${TODAY}">
    </div>
    <div class="form-group">
      <label>Asunto</label>
      <input type="text" id="pc-subject" placeholder="Asunto del contacto">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveProjectContact('${projectId}')">Guardar</button>
    </div>
  `)
  setTimeout(() => document.getElementById('pc-subject')?.focus(), 50)
}

async function saveProjectContact(projectId) {
  const date = document.getElementById('pc-date')?.value
  const subject = document.getElementById('pc-subject')?.value?.trim()
  if (!date || !subject) return
  const { data, error } = await db.from('project_contacts').insert({ project_id: projectId, date, subject }).select().single()
  if (error) { console.error(error); return }
  if (!projectContacts[projectId]) projectContacts[projectId] = []
  projectContacts[projectId].unshift(data)
  renderProjects()
  closeModal()
}

async function deleteProjectContact(contactId, projectId) {
  await db.from('project_contacts').delete().eq('id', contactId)
  if (projectContacts[projectId])
    projectContacts[projectId] = projectContacts[projectId].filter(c => c.id !== contactId)
  renderProjects()
}

// ── NOTES ─────────────────────────────────────────────────

function scheduleNoteSave(projectId, value) {
  clearTimeout(notesDebounce[projectId])
  notesDebounce[projectId] = setTimeout(() => saveProjectNotes(projectId, value), 800)
}

async function saveProjectNotes(projectId, notes) {
  await db.from('projects').update({ notes }).eq('id', projectId)
  const p = allProjects.find(p => p.id === projectId)
  if (p) p.notes = notes
}

// ── PROJECT TASKS ─────────────────────────────────────────

function openAddProjectTask(projectId) {
  openModal('Añadir tarea al proyecto', `
    <div id="task-rows"></div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveProjectTask('${projectId}')">Guardar</button>
    </div>
  `)
  addTaskRow('Nombre de la tarea')
  document.getElementById('task-rows').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('task-multi-input')) {
      e.preventDefault()
      addTaskRow('Nombre de la tarea', e.target.closest('.task-row'))
    }
  })
  document.getElementById('task-rows').addEventListener('click', e => {
    if (e.target.classList.contains('row-del')) {
      const rows = document.querySelectorAll('.task-row')
      if (rows.length > 1) { e.target.closest('.task-row').remove(); syncDeleteButtons() }
    }
  })
}

async function saveProjectTask(projectId) {
  const titles = [...document.querySelectorAll('.task-multi-input')]
    .map(i => i.value.trim()).filter(Boolean)
  if (!titles.length) return
  const posStart = maxPos('todas') + 1
  const rows = titles.map((title, i) => ({
    title,
    is_micro: false,
    in_todas: true,
    in_semana: false,
    in_hoy: false,
    project_id: projectId,
    [POS.todas]: posStart + i
  }))
  const { data, error } = await db.from('tasks').insert(rows).select()
  if (error) { console.error(error); return }
  allTasks.push(...data)
  renderTasks()
  renderProjects()
  closeModal()
}

function openEditProjectTask(id) {
  const task = allTasks.find(t => t.id === id)
  if (!task) return
  openModal('Editar tarea', `
    <div class="form-group">
      <label>Título</label>
      <input type="text" id="edit-task-title" value="${escHtml(task.title)}">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEditProjectTask('${id}')">Guardar</button>
    </div>
  `)
  setTimeout(() => { const i = document.getElementById('edit-task-title'); if (i) { i.focus(); i.select() } }, 50)
}

async function saveEditProjectTask(id) {
  const title = document.getElementById('edit-task-title')?.value?.trim()
  if (!title) return
  await db.from('tasks').update({ title }).eq('id', id)
  const task = allTasks.find(t => t.id === id)
  if (task) task.title = title
  renderTasks()
  renderProjects()
  closeModal()
}

async function deleteProjectTask(taskId) {
  await db.from('tasks').delete().eq('id', taskId)
  allTasks = allTasks.filter(t => t.id !== taskId)
  renderTasks()
  renderProjects()
}

async function toggleProjectTask(id, checked) {
  await db.from('tasks').update({ done: checked }).eq('id', id)
  const task = allTasks.find(t => t.id === id)
  if (task) task.done = checked
  renderTasks()
  renderProjects()
}

// ── STATUS CYCLE ──────────────────────────────────────────

async function cycleProjectStatus(id) {
  const p = allProjects.find(p => p.id === id)
  if (!p) return
  const idx = STATUS_CYCLE.indexOf(p.status || 'activo')
  const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
  await db.from('projects').update({ status: next }).eq('id', id)
  p.status = next
  renderProjects()
}

// ── DRAG & DROP REORDER ───────────────────────────────────

function onProjectDragStart(e, id) {
  dragProjectId = id
  e.dataTransfer.effectAllowed = 'move'
  requestAnimationFrame(() => {
    const el = e.target.closest('.project-card')
    if (el) el.classList.add('dragging')
  })
}

function onProjectDragEnd(e) {
  document.querySelectorAll('.project-card.dragging').forEach(el => el.classList.remove('dragging'))
  document.querySelectorAll('.project-card.drop-above, .project-card.drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below')
  })
  dragProjectId = null
}

function onProjectDragOver(e, targetId) {
  if (dragProjectId === targetId) return
  e.preventDefault()
  e.stopPropagation()
  const item = e.currentTarget
  const rect = item.getBoundingClientRect()
  document.querySelectorAll('.project-card.drop-above, .project-card.drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below')
  })
  item.classList.toggle('drop-above', e.clientY < rect.top + rect.height / 2)
  item.classList.toggle('drop-below', e.clientY >= rect.top + rect.height / 2)
}

function onProjectDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drop-above', 'drop-below')
  }
}

async function onProjectDrop(e, targetId) {
  if (dragProjectId === targetId) return
  e.preventDefault()
  e.stopPropagation()
  const item = e.currentTarget
  const rect = item.getBoundingClientRect()
  const insertBefore = e.clientY < rect.top + rect.height / 2
  item.classList.remove('drop-above', 'drop-below')

  const dragIdx = allProjects.findIndex(p => p.id === dragProjectId)
  const [dragItem] = allProjects.splice(dragIdx, 1)
  const newTargetIdx = allProjects.findIndex(p => p.id === targetId)
  allProjects.splice(insertBefore ? newTargetIdx : newTargetIdx + 1, 0, dragItem)

  allProjects.forEach((p, i) => { p.position = i })
  await Promise.all(allProjects.map(p => db.from('projects').update({ position: p.position }).eq('id', p.id)))
  renderProjects()
  dragProjectId = null
}
