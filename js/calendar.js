let allEvents = []
let eventTasks = {}
let festivos = new Set()
let calWeekOffset = 0    // desplazamiento en semanas (±4 por clic)

function calPrev()    { calWeekOffset -= 4; renderCalendar() }
function calNext()    { calWeekOffset += 4; renderCalendar() }
function calGoToday() { calWeekOffset  = 0; renderCalendar() }

const EVENT_COLORS = [
  '#4f46e5', // indigo
  '#0891b2', // cyan
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#db2777', // pink
  '#0284c7', // sky
]

async function loadCalendar() {
  const [eventsRes, festivosRes] = await Promise.all([
    db.from('events').select('*').order('date'),
    db.from('festivos').select('date')
  ])
  if (eventsRes.error) { console.error(eventsRes.error); return }
  allEvents = eventsRes.data || []
  festivos = new Set((festivosRes.data || []).map(f => f.date))

  if (allEvents.length) {
    const ids = allEvents.map(e => e.id)
    const { data: tasks } = await db.from('event_tasks').select('*').in('event_id', ids)
    eventTasks = {}
    if (tasks) tasks.forEach(t => {
      if (!eventTasks[t.event_id]) eventTasks[t.event_id] = []
      eventTasks[t.event_id].push(t)
    })
  }
  renderCalendar()
}

// ── Date helpers ──────────────────────────────────────────
function calAddDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function calStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function calDiff(a, b) {          // days from date a to date b
  return Math.round((b - a) / 86400000)
}

// ── Main render ───────────────────────────────────────────
function renderCalendar() {
  const container = document.getElementById('cal-grid')
  if (!container) return

  const today = new Date(TODAY + 'T00:00:00')
  const dow = today.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const start = calAddDays(today, mondayOffset + calWeekOffset * 7)

  // Month label
  const endDate   = calAddDays(start, 34)
  const fmtOpts   = { month: 'long', year: 'numeric' }
  const fmtMonth  = { month: 'long' }
  const sLabel    = start.toLocaleDateString('es-ES', fmtOpts)
  const eLabel    = endDate.toLocaleDateString('es-ES', fmtOpts)
  const monthLabel = sLabel === eLabel
    ? sLabel
    : `${start.toLocaleDateString('es-ES', fmtMonth)} – ${eLabel}`
  const isCurrentView = calWeekOffset === 0

  let html = `
    <div class="cal-month-label">
      <span class="cal-month-text">${monthLabel}</span>
      ${!isCurrentView ? `<button class="cal-today-btn" onclick="calGoToday()">Hoy</button>` : ''}
    </div>
    <div class="cal-header-row">
      <div class="cal-hcell">L</div>
      <div class="cal-hcell">M</div>
      <div class="cal-hcell">X</div>
      <div class="cal-hcell">J</div>
      <div class="cal-hcell">V</div>
      <div class="cal-hcell cal-wknd-hdr">S</div>
      <div class="cal-hcell cal-wknd-hdr">D</div>
    </div>`

  for (let w = 0; w < 5; w++) {
    const days = Array.from({ length: 7 }, (_, d) => calAddDays(start, w * 7 + d))
    html += renderWeek(days)
  }
  container.innerHTML = html
}

function renderWeek(weekDays) {
  const ws = calStr(weekDays[0])
  const we = calStr(weekDays[6])
  const MAX = 5
  const LANE_H = 22
  const LANE_GAP = 3

  // ── Split events into periods and singles ──
  const periods = []
  const singles = {}    // dateStr -> [{event, _idx}]

  allEvents.forEach((e, idx) => {
    if (e.end_date) {
      if (e.date <= we && e.end_date >= ws) {
        const startCol = Math.max(0, calDiff(weekDays[0], new Date(e.date + 'T00:00:00')))
        const endCol   = Math.min(6, calDiff(weekDays[0], new Date(e.end_date + 'T00:00:00')))
        periods.push({ ...e, _idx: idx, startCol, endCol })
      }
    } else {
      if (e.date >= ws && e.date <= we) {
        if (!singles[e.date]) singles[e.date] = []
        singles[e.date].push({ ...e, _idx: idx })
      }
    }
  })

  // ── Assign lanes to periods ──
  periods.sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol))
  const lanes = []
  periods.forEach(e => {
    let placed = false
    for (let i = 0; i < lanes.length; i++) {
      if (e.startCol > lanes[i][lanes[i].length - 1].endCol) {
        lanes[i].push(e); e._lane = i; placed = true; break
      }
    }
    if (!placed) { e._lane = lanes.length; lanes.push([e]) }
  })

  const laneCount  = lanes.length
  const overlayH   = laneCount > 0 ? laneCount * (LANE_H + LANE_GAP) + 2 : 0

  // Periods per column (to calculate remaining slots for singles)
  const periodsByCol = Array(7).fill(0)
  periods.forEach(e => {
    for (let c = e.startCol; c <= e.endCol; c++) periodsByCol[c]++
  })

  // ── Period bars HTML ──
  let barsHtml = ''
  periods.forEach(e => {
    if (e._lane >= MAX) return           // skip if beyond max visible
    const color        = EVENT_COLORS[e._idx % EVENT_COLORS.length]
    const leftPct      = (e.startCol / 7 * 100).toFixed(3)
    const widthPct     = ((e.endCol - e.startCol + 1) / 7 * 100).toFixed(3)
    const topPx        = e._lane * (LANE_H + LANE_GAP)
    const isPast       = e.end_date < TODAY
    const goesLeft     = e.date < ws
    const goesRight    = e.end_date > we
    const brTL = goesLeft  ? '0' : '5px'
    const brBL = goesLeft  ? '0' : '5px'
    const brTR = goesRight ? '0' : '5px'
    const brBR = goesRight ? '0' : '5px'

    barsHtml += `
      <div class="period-bar${isPast ? ' period-past' : ''}"
           style="left:${leftPct}%;width:${widthPct}%;top:${topPx}px;height:${LANE_H}px;
                  background:${color};border-radius:${brTL} ${brTR} ${brBR} ${brBL}"
           onclick="openEditEvent('${e.id}')"
           title="${escHtml(e.name)}${e.location ? ' · ' + e.location : ''}">
        ${goesLeft  ? '<span class="bar-arrow">◀</span>' : ''}
        <span class="bar-name">${escHtml(e.name)}</span>
        ${goesRight ? '<span class="bar-arrow">▶</span>' : ''}
      </div>`
  })

  // ── Day cells HTML ──
  const daysHtml = weekDays.map((d, col) => {
    const ds       = calStr(d)
    const isToday  = ds === TODAY
    const isPast   = ds < TODAY
    const isWknd   = col >= 5
    const isFest   = festivos.has(ds)
    const isRed    = isWknd || isFest

    const daySingles  = singles[ds] || []
    const slotsLeft   = Math.max(0, MAX - periodsByCol[col])
    const visible     = daySingles.slice(0, slotsLeft)
    const hiddenCount = daySingles.length - visible.length
                      + Math.max(0, periodsByCol[col] - MAX)

    const pillsHtml = visible.map(e => {
      const color  = EVENT_COLORS[e._idx % EVENT_COLORS.length]
      const ePast  = e.date < TODAY
      return `<div class="event-pill${ePast ? ' pill-past' : ''}"
                   style="background:${color}22;border-left:3px solid ${color};color:${color}"
                   onclick="openEditEvent('${e.id}')"
                   title="${escHtml(e.name)}">${escHtml(e.name)}</div>`
    }).join('')

    const moreBtn = hiddenCount > 0
      ? `<button class="day-more-btn" onclick="openDayEvents('${ds}')">+${hiddenCount} más</button>`
      : ''

    const dblClick = !isWknd
      ? `ondblclick="toggleFestivo('${ds}')" title="Doble clic para marcar festivo"`
      : ''

    return `
      <div class="cal-day${isToday ? ' cal-today' : ''}${isPast && !isToday ? ' cal-past' : ''}">
        <span class="day-num${isRed ? ' day-red' : ''}${isFest ? ' day-festivo' : ''}" ${dblClick}>${d.getDate()}</span>
        <div class="day-singles">${pillsHtml}${moreBtn}</div>
      </div>`
  }).join('')

  return `
    <div class="cal-week">
      <div class="cal-periods-overlay" style="height:${overlayH}px${laneCount === 0 ? ';display:none' : ''}">
        ${barsHtml}
      </div>
      <div class="cal-days-row">${daysHtml}</div>
    </div>`
}

// ── Festivos ──────────────────────────────────────────────
async function toggleFestivo(ds) {
  if (festivos.has(ds)) {
    await db.from('festivos').delete().eq('date', ds)
    festivos.delete(ds)
  } else {
    await db.from('festivos').insert({ date: ds })
    festivos.add(ds)
  }
  renderCalendar()
}

// ── Day popup (more events) ───────────────────────────────
function openDayEvents(ds) {
  const evs = allEvents.filter(e =>
    e.end_date ? (e.date <= ds && e.end_date >= ds) : e.date === ds
  )
  const listHtml = evs.map(e => {
    const color    = EVENT_COLORS[allEvents.indexOf(e) % EVENT_COLORS.length]
    const isPeriod = !!e.end_date
    return `
      <li style="padding:8px 12px;border-radius:8px;border-left:4px solid ${color};
                 background:${color}15;cursor:pointer"
          onclick="closeModal();setTimeout(()=>openEditEvent('${e.id}'),60)">
        <div style="font-weight:500;font-size:13px">${escHtml(e.name)}</div>
        <div style="font-size:11px;color:var(--text-secondary)">
          ${isPeriod ? `${formatDate(e.date)} – ${formatDate(e.end_date)}` : formatDate(e.date)}
          ${e.location ? ` · 📍 ${escHtml(e.location)}` : ''}
        </div>
      </li>`
  }).join('')

  openModal(`Eventos · ${formatDate(ds)}`, `
    <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
      ${listHtml}
    </ul>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
    </div>`)
}

// ── Add event ─────────────────────────────────────────────
function openAddEvent() {
  openModal('Nuevo evento', `
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="ev-name" placeholder="Nombre del evento">
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select id="ev-type">
        <option value="single">Evento puntual</option>
        <option value="period">Periodo (varios días)</option>
      </select>
    </div>
    <div class="form-group">
      <label id="ev-date-lbl">Fecha</label>
      <input type="date" id="ev-date" value="${TODAY}">
    </div>
    <div class="form-group" id="ev-end-grp" style="display:none">
      <label>Fecha fin</label>
      <input type="date" id="ev-enddate" value="${TODAY}">
    </div>
    <div class="form-group">
      <label>Lugar (opcional)</label>
      <input type="text" id="ev-location" placeholder="Lugar del evento">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEvent()">Guardar</button>
    </div>`)
  setTimeout(() => {
    document.getElementById('ev-name')?.focus()
    document.getElementById('ev-type')?.addEventListener('change', function () {
      const p = this.value === 'period'
      document.getElementById('ev-end-grp').style.display = p ? '' : 'none'
      document.getElementById('ev-date-lbl').textContent  = p ? 'Fecha inicio' : 'Fecha'
    })
  }, 50)
}

async function saveEvent() {
  const name     = document.getElementById('ev-name')?.value?.trim()
  const date     = document.getElementById('ev-date')?.value
  const type     = document.getElementById('ev-type')?.value
  const end_date = type === 'period' ? (document.getElementById('ev-enddate')?.value || null) : null
  const location = document.getElementById('ev-location')?.value?.trim() || null
  if (!name || !date) return
  if (type === 'period' && end_date && end_date < date) {
    alert('La fecha fin debe ser posterior o igual a la inicio'); return
  }
  const { data, error } = await db.from('events').insert({ name, date, end_date, location }).select().single()
  if (error) { console.error(error); return }
  allEvents.push(data)
  allEvents.sort((a, b) => a.date.localeCompare(b.date))
  renderCalendar()
  closeModal()
}

// ── Edit event ────────────────────────────────────────────
function openEditEvent(id) {
  const e = allEvents.find(ev => ev.id === id)
  if (!e) return
  const isPeriod = !!e.end_date
  const tasks    = eventTasks[e.id] || []

  const tasksHtml = tasks.length ? `
    <div class="form-group">
      <label>Tareas del evento</label>
      <ul class="event-tasks-list">
        ${tasks.map(t => `
          <li class="event-task-item ${t.done ? 'done' : ''}">
            <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleEventTask('${t.id}','${e.id}',this.checked)">
            <span>${escHtml(t.title)}</span>
            <button class="btn-icon" onclick="deleteEventTask('${t.id}','${e.id}')">✕</button>
          </li>`).join('')}
      </ul>
    </div>` : ''

  openModal('Editar evento', `
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="ev-name" value="${escHtml(e.name)}">
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select id="ev-type">
        <option value="single" ${!isPeriod ? 'selected' : ''}>Evento puntual</option>
        <option value="period" ${isPeriod  ? 'selected' : ''}>Periodo (varios días)</option>
      </select>
    </div>
    <div class="form-group">
      <label id="ev-date-lbl">${isPeriod ? 'Fecha inicio' : 'Fecha'}</label>
      <input type="date" id="ev-date" value="${e.date}">
    </div>
    <div class="form-group" id="ev-end-grp" style="${isPeriod ? '' : 'display:none'}">
      <label>Fecha fin</label>
      <input type="date" id="ev-enddate" value="${e.end_date || ''}">
    </div>
    <div class="form-group">
      <label>Lugar (opcional)</label>
      <input type="text" id="ev-location" value="${escHtml(e.location || '')}">
    </div>
    ${tasksHtml}
    <div class="form-actions">
      <button class="btn btn-secondary btn-danger-soft" onclick="deleteEvent('${e.id}')">Eliminar</button>
      <button class="btn btn-secondary" onclick="openAddEventTask('${e.id}')">+ Tarea</button>
      <button class="btn btn-primary" onclick="updateEvent('${e.id}')">Guardar</button>
    </div>`)
  setTimeout(() => {
    document.getElementById('ev-type')?.addEventListener('change', function () {
      const p = this.value === 'period'
      document.getElementById('ev-end-grp').style.display = p ? '' : 'none'
      document.getElementById('ev-date-lbl').textContent  = p ? 'Fecha inicio' : 'Fecha'
    })
  }, 50)
}

async function updateEvent(id) {
  const name     = document.getElementById('ev-name')?.value?.trim()
  const date     = document.getElementById('ev-date')?.value
  const type     = document.getElementById('ev-type')?.value
  const end_date = type === 'period' ? (document.getElementById('ev-enddate')?.value || null) : null
  const location = document.getElementById('ev-location')?.value?.trim() || null
  if (!name || !date) return
  const { error } = await db.from('events').update({ name, date, end_date, location }).eq('id', id)
  if (error) { console.error(error); return }
  const ev = allEvents.find(e => e.id === id)
  if (ev) Object.assign(ev, { name, date, end_date, location })
  allEvents.sort((a, b) => a.date.localeCompare(b.date))
  renderCalendar()
  closeModal()
}

async function deleteEvent(id) {
  await db.from('events').delete().eq('id', id)
  allEvents = allEvents.filter(e => e.id !== id)
  delete eventTasks[id]
  renderCalendar()
  closeModal()
}

// ── Event tasks ───────────────────────────────────────────
async function toggleEventTask(taskId, eventId, checked) {
  await db.from('event_tasks').update({ done: checked }).eq('id', taskId)
  const t = (eventTasks[eventId] || []).find(x => x.id === taskId)
  if (t) t.done = checked
}

function openAddEventTask(eventId) {
  openModal('Nueva tarea del evento', `
    <div class="form-group">
      <label>Tarea</label>
      <input type="text" id="etask-title" placeholder="Qué hay que hacer">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEventTask('${eventId}')">Guardar</button>
    </div>`)
  setTimeout(() => document.getElementById('etask-title')?.focus(), 50)
}

async function saveEventTask(eventId) {
  const title = document.getElementById('etask-title')?.value?.trim()
  if (!title) return
  const { data, error } = await db.from('event_tasks').insert({ event_id: eventId, title }).select().single()
  if (error) { console.error(error); return }
  if (!eventTasks[eventId]) eventTasks[eventId] = []
  eventTasks[eventId].push(data)
  renderCalendar()
  closeModal()
}

async function deleteEventTask(taskId, eventId) {
  await db.from('event_tasks').delete().eq('id', taskId)
  if (eventTasks[eventId])
    eventTasks[eventId] = eventTasks[eventId].filter(t => t.id !== taskId)
  renderCalendar()
  closeModal()
  setTimeout(() => openEditEvent(eventId), 60)
}
