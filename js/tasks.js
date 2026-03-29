let allTasks = []
let dragTaskId = null
let dragFromCol = null
let showAllTodas = false

const TODAS_LIMIT = 10

// Mapa columna → campo de posición
const POS = {
  todas:  'position',
  semana: 'position_semana',
  hoy:    'position_hoy',
  micro:  'position_micro'
}

// ── LOAD & RENDER ────────────────────────────────────────

async function loadTasks() {
  const { data, error } = await db.from('tasks').select('*')
  if (error) { console.error(error); return }
  allTasks = data
  renderTasks()
}

function getColTasks(col) {
  switch (col) {
    case 'todas':  return allTasks.filter(t => !t.is_micro && t.in_todas)
    case 'semana': return allTasks.filter(t => !t.is_micro && t.in_semana)
    case 'hoy':    return allTasks.filter(t => t.in_hoy)
    case 'micro':  return allTasks.filter(t => t.is_micro && !t.in_hoy)
  }
  return []
}

function sortedCol(col) {
  const f = POS[col]
  return getColTasks(col).sort((a, b) => (a[f] ?? 0) - (b[f] ?? 0))
}

function maxPos(col) {
  const f = POS[col]
  return getColTasks(col).reduce((m, t) => Math.max(m, t[f] ?? 0), -1)
}

function renderTasks() {
  renderTodas(sortedCol('todas'))
  renderCol('list-week',  sortedCol('semana'), 'semana')
  renderCol('list-today', sortedCol('hoy'),    'hoy')
  renderCol('list-micro', sortedCol('micro'),  'micro')
}

function renderTodas(tasks) {
  const ul = document.getElementById('list-all')
  if (!tasks.length) { ul.innerHTML = '<li class="empty">Sin tareas</li>'; return }

  const visible = showAllTodas ? tasks : tasks.slice(0, TODAS_LIMIT)
  const hasMore = tasks.length > TODAS_LIMIT

  ul.innerHTML = visible.map(t => taskHTML(t, 'todas')).join('')

  if (hasMore) {
    const li = document.createElement('li')
    li.className = 'show-more'
    li.innerHTML = showAllTodas
      ? `<button onclick="toggleShowAll()">Mostrar menos ▲</button>`
      : `<button onclick="toggleShowAll()">Mostrar todo · ${tasks.length - TODAS_LIMIT} más ▼</button>`
    ul.appendChild(li)
  }
}

function renderCol(listId, tasks, col) {
  const ul = document.getElementById(listId)
  if (!tasks.length) {
    ul.innerHTML = `<li class="empty">${col === 'micro' ? 'Sin microtareas' : 'Sin tareas'}</li>`
    return
  }
  ul.innerHTML = tasks.map(t => taskHTML(t, col)).join('')
}

function toggleShowAll() {
  showAllTodas = !showAllTodas
  renderTasks()
}

// ── TASK HTML ────────────────────────────────────────────

function taskHTML(t, col) {
  const project = t.project_id && typeof allProjects !== 'undefined'
    ? allProjects.find(p => p.id === t.project_id)
    : null
  const projectBadge = project
    ? `<span class="task-project-badge">${escHtml(project.name)}</span>`
    : ''
  return `
    <li class="task-item ${t.done ? 'done' : ''}"
        data-id="${t.id}"
        draggable="true"
        ondragstart="onDragStart(event,'${t.id}','${col}')"
        ondragend="onDragEnd(event)"
        ondragover="onDragOverItem(event,'${t.id}','${col}')"
        ondragleave="onDragLeaveItem(event)"
        ondrop="onDropOnItem(event,'${t.id}','${col}')">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}',this.checked)">
      <span class="task-text">${escHtml(t.title)}</span>${projectBadge}
      <span class="task-actions">
        <button class="btn-icon btn-edit"   onclick="openEditTask('${t.id}')"         title="Editar">✎</button>
        <button class="btn-icon btn-delete" onclick="removeFromCol('${t.id}','${col}')" title="Quitar">✕</button>
      </span>
    </li>`
}

// ── DRAG START / END ─────────────────────────────────────

function onDragStart(e, taskId, col) {
  dragTaskId = taskId
  dragFromCol = col
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', taskId)
  requestAnimationFrame(() => {
    const el = e.target.closest('.task-item')
    if (el) el.classList.add('dragging')
  })
}

function onDragEnd(e) {
  document.querySelectorAll('.task-item.dragging').forEach(el => el.classList.remove('dragging'))
  document.querySelectorAll('.panel.drag-over').forEach(el => el.classList.remove('drag-over'))
  clearDropIndicators()
}

function clearDropIndicators() {
  document.querySelectorAll('.task-item.drop-above, .task-item.drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below')
  })
}

// ── DRAG OVER / LEAVE ITEMS (reorder + drop-over visual) ─

function onDragOverItem(e, targetId, col) {
  if (dragTaskId === targetId) return
  const isSameCol = dragFromCol === col
  const isCrossCol = canDrop(dragFromCol, col)
  if (!isSameCol && !isCrossCol) return

  e.preventDefault()
  e.stopPropagation()

  if (isSameCol) {
    const item = e.currentTarget
    clearDropIndicators()
    const rect = item.getBoundingClientRect()
    item.classList.toggle('drop-above', e.clientY < rect.top + rect.height / 2)
    item.classList.toggle('drop-below', e.clientY >= rect.top + rect.height / 2)
  }
}

function onDragLeaveItem(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drop-above', 'drop-below')
  }
}

// ── DROP ON ITEM ─────────────────────────────────────────

function onDropOnItem(e, targetId, col) {
  if (dragTaskId === targetId) return
  e.preventDefault()
  e.stopPropagation()
  clearDropIndicators()

  if (dragFromCol === col) {
    // Reorder within column
    const item = e.currentTarget
    const rect = item.getBoundingClientRect()
    const insertBefore = e.clientY < rect.top + rect.height / 2
    reorderTask(dragTaskId, targetId, col, insertBefore)
  } else if (canDrop(dragFromCol, col)) {
    // Cross-column drop landing on an item
    dropTask(dragTaskId, dragFromCol, col)
  }

  dragTaskId = null
  dragFromCol = null
}

// ── REORDER WITHIN COLUMN ────────────────────────────────

async function reorderTask(dragId, targetId, col, insertBefore) {
  const f = POS[col]
  let list = sortedCol(col)

  const dragIdx = list.findIndex(t => t.id === dragId)
  const [dragItem] = list.splice(dragIdx, 1)
  const newTargetIdx = list.findIndex(t => t.id === targetId)
  list.splice(insertBefore ? newTargetIdx : newTargetIdx + 1, 0, dragItem)

  list.forEach((t, i) => { t[f] = i })
  await Promise.all(list.map(t => db.from('tasks').update({ [f]: t[f] }).eq('id', t.id)))
  renderTasks()
}

// ── DROP BETWEEN COLUMNS ─────────────────────────────────

const validDrops = {
  todas:  ['semana', 'hoy'],
  semana: ['hoy'],
  micro:  ['hoy'],
  hoy:    []
}

function canDrop(from, to) {
  return from !== to && (validDrops[from] || []).includes(to)
}

function setupDropZones() {
  document.querySelectorAll('.tasks-grid .panel[data-col]').forEach(panel => {
    const col = panel.dataset.col

    panel.addEventListener('dragover', e => {
      if (dragFromCol && canDrop(dragFromCol, col)) {
        e.preventDefault()
        panel.classList.add('drag-over')
      }
    })
    panel.addEventListener('dragleave', e => {
      if (!panel.contains(e.relatedTarget)) panel.classList.remove('drag-over')
    })
    panel.addEventListener('drop', e => {
      e.preventDefault()
      panel.classList.remove('drag-over')
      if (dragTaskId && dragFromCol && canDrop(dragFromCol, col)) {
        dropTask(dragTaskId, dragFromCol, col)
      }
      dragTaskId = null
      dragFromCol = null
    })
  })
}

async function dropTask(taskId, from, to) {
  const task = allTasks.find(t => t.id === taskId)
  if (!task) return

  let update = {}

  if (task.is_micro) {
    update = { in_hoy: true, [POS.hoy]: maxPos('hoy') + 1 }
  } else {
    if (from === 'todas' && to === 'semana') {
      update = { in_semana: true, [POS.semana]: maxPos('semana') + 1 }
    } else if (to === 'hoy') {
      update = { in_semana: true, in_hoy: true, [POS.hoy]: maxPos('hoy') + 1 }
      if (!task.in_semana) update[POS.semana] = maxPos('semana') + 1
    }
  }

  await db.from('tasks').update(update).eq('id', taskId)
  Object.assign(task, update)
  renderTasks()
}

// ── REMOVE FROM COLUMN ───────────────────────────────────

async function removeFromCol(id, col) {
  const task = allTasks.find(t => t.id === id)
  if (!task) return

  if (col === 'todas' || col === 'micro') {
    await db.from('tasks').delete().eq('id', id)
    allTasks = allTasks.filter(t => t.id !== id)
    if (typeof renderProjects === 'function') renderProjects()
  } else {
    const update =
      col === 'semana' ? { in_semana: false, in_hoy: false } :
      col === 'hoy'    ? { in_hoy: false } : null
    if (!update) return
    await db.from('tasks').update(update).eq('id', id)
    Object.assign(task, update)
  }
  renderTasks()
}

// ── TOGGLE DONE ──────────────────────────────────────────

async function toggleTask(id, checked) {
  await db.from('tasks').update({ done: checked }).eq('id', id)
  const task = allTasks.find(t => t.id === id)
  if (task) task.done = checked
  renderTasks()
  if (typeof renderProjects === 'function') renderProjects()
}

// ── EDIT ─────────────────────────────────────────────────

function openEditTask(id) {
  const task = allTasks.find(t => t.id === id)
  if (!task) return
  openModal(task.is_micro ? 'Editar microtarea' : 'Editar tarea', `
    <div class="form-group">
      <label>Título</label>
      <input type="text" id="edit-task-title" value="${escHtml(task.title)}">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEditTask('${id}')">Guardar</button>
    </div>
  `)
  setTimeout(() => {
    const input = document.getElementById('edit-task-title')
    if (input) { input.focus(); input.select() }
  }, 50)
}

async function saveEditTask(id) {
  const title = document.getElementById('edit-task-title')?.value?.trim()
  if (!title) return
  await db.from('tasks').update({ title }).eq('id', id)
  const task = allTasks.find(t => t.id === id)
  if (task) task.title = title
  renderTasks()
  if (typeof renderProjects === 'function') renderProjects()
  closeModal()
}

// ── ADD NEW (multi-línea) ────────────────────────────────

function openAddTask(scope) {
  const isMicro = scope === 'micro'
  const placeholder = isMicro ? 'Nombre de la microtarea' : 'Nombre de la tarea'

  openModal(isMicro ? 'Nuevas microtareas' : 'Nuevas tareas', `
    <div id="task-rows"></div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveTask('${scope}')">Guardar</button>
    </div>
  `)

  addTaskRow(placeholder)
  document.getElementById('task-rows').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('task-multi-input')) {
      e.preventDefault()
      addTaskRow(placeholder, e.target.closest('.task-row'))
    }
  })
  document.getElementById('task-rows').addEventListener('click', e => {
    if (e.target.classList.contains('row-del')) {
      const rows = document.querySelectorAll('.task-row')
      if (rows.length > 1) { e.target.closest('.task-row').remove(); syncDeleteButtons() }
    }
  })
}

function addTaskRow(placeholder, afterEl) {
  const row = document.createElement('div')
  row.className = 'task-row'
  row.innerHTML = `
    <input type="text" class="task-multi-input" placeholder="${placeholder}">
    <button class="btn-icon row-del" title="Eliminar fila">✕</button>
  `
  const container = document.getElementById('task-rows')
  if (afterEl) afterEl.insertAdjacentElement('afterend', row)
  else container.appendChild(row)
  row.querySelector('.task-multi-input').focus()
  syncDeleteButtons()
}

function syncDeleteButtons() {
  const rows = document.querySelectorAll('.task-row')
  rows.forEach(r => {
    r.querySelector('.row-del').style.visibility = rows.length > 1 ? 'visible' : 'hidden'
  })
}

async function saveTask(scope) {
  const titles = [...document.querySelectorAll('.task-multi-input')]
    .map(i => i.value.trim()).filter(Boolean)
  if (!titles.length) return

  const colMap = {
    all:   { is_micro: false, in_todas: true,  in_semana: false, in_hoy: false },
    week:  { is_micro: false, in_todas: true,  in_semana: true,  in_hoy: false },
    today: { is_micro: false, in_todas: true,  in_semana: true,  in_hoy: true  },
    micro: { is_micro: true,  in_todas: false, in_semana: false, in_hoy: false },
  }
  const base = colMap[scope]

  // Positions per relevant column
  const posTodasStart  = maxPos('todas')  + 1
  const posSemanaStart = maxPos('semana') + 1
  const posHoyStart    = maxPos('hoy')    + 1
  const posMicroStart  = maxPos('micro')  + 1

  const rows = titles.map((title, i) => {
    const r = { title, ...base }
    if (scope === 'all'   || scope === 'week' || scope === 'today') r[POS.todas]  = posTodasStart  + i
    if (scope === 'week'  || scope === 'today')                      r[POS.semana] = posSemanaStart + i
    if (scope === 'today')                                            r[POS.hoy]    = posHoyStart    + i
    if (scope === 'micro')                                            r[POS.micro]  = posMicroStart  + i
    return r
  })

  const { data, error } = await db.from('tasks').insert(rows).select()
  if (error) { console.error(error); return }
  allTasks.push(...data)
  renderTasks()
  closeModal()
}
