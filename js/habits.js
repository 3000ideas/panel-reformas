// ── STATE ──────────────────────────────────────────────────────
let habitYear  = +TODAY.slice(0, 4)
let habitMonth = +TODAY.slice(5, 7)
let allHabits  = []
let habitLogs  = {} // { habit_id: { 'YYYY-MM-DD': true } }

const DOW_ES = ['L','M','X','J','V','S','D']
const MES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

function habitDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── LOAD ───────────────────────────────────────────────────────
async function loadHabits() {
  await loadHabitsForMonth(habitYear, habitMonth)
}

async function loadHabitsForMonth(year, month) {
  const pad = n => String(n).padStart(2, '0')
  const firstDay    = `${year}-${pad(month)}-01`
  const daysInMonth = new Date(year, month, 0).getDate()
  const lastDay     = `${year}-${pad(month)}-${pad(daysInMonth)}`

  const [habitsRes, logsRes] = await Promise.all([
    db.from('habits').select('*').eq('year', year).eq('month', month).order('position'),
    db.from('habit_logs').select('*').gte('date', firstDay).lte('date', lastDay)
  ])

  if (habitsRes.error) { console.error(habitsRes.error); return }
  allHabits = habitsRes.data || []

  habitLogs = {}
  ;(logsRes.data || []).forEach(log => {
    if (!habitLogs[log.habit_id]) habitLogs[log.habit_id] = {}
    habitLogs[log.habit_id][log.date] = log.completed
  })

  renderHabits()
}

// ── NAVIGATE ───────────────────────────────────────────────────
async function navigateHabitMonth(dir) {
  habitMonth += dir
  if (habitMonth > 12) { habitMonth = 1; habitYear++ }
  if (habitMonth < 1)  { habitMonth = 12; habitYear-- }
  await loadHabitsForMonth(habitYear, habitMonth)
}

// ── RENDER ─────────────────────────────────────────────────────
function renderHabits() {
  const container = document.getElementById('habits-container')
  if (!container) return

  const daysInMonth = new Date(habitYear, habitMonth, 0).getDate()
  const monthLabel  = `${MES_ES[habitMonth - 1]} '${String(habitYear).slice(2)}`

  // Cabecera: día semana y número de día
  let dowCells = '<th class="habit-name-th"></th>'
  let dayCells = '<th class="habit-name-th"></th>'

  for (let d = 1; d <= daysInMonth; d++) {
    const date      = new Date(habitYear, habitMonth - 1, d)
    const dow       = (date.getDay() + 6) % 7   // 0=Lun … 6=Dom
    const dateStr   = habitDateStr(date)
    const isToday   = dateStr === TODAY
    const isWeekend = dow >= 5

    const cls = [isToday ? 'hcol-today' : '', isWeekend ? 'hcol-weekend' : ''].filter(Boolean).join(' ')
    dowCells += `<th class="${cls}">${DOW_ES[dow]}</th>`
    dayCells += `<th class="${cls}">${d}</th>`
  }

  dowCells += '<th class="habit-success-th">ÉXITO</th>'
  dayCells += '<th class="habit-success-th">%</th>'

  // Filas de hábitos
  let bodyRows = ''
  if (!allHabits.length) {
    bodyRows = `<tr><td colspan="${daysInMonth + 2}" class="habits-empty">Sin hábitos — añade uno abajo</td></tr>`
  } else {
    bodyRows = allHabits.map(h => {
      let cells = ''
      let completedCount = 0
      let totalDays = 0

      for (let d = 1; d <= daysInMonth; d++) {
        const date      = new Date(habitYear, habitMonth - 1, d)
        const dateStr   = habitDateStr(date)
        const isFuture  = dateStr > TODAY
        const dow       = (date.getDay() + 6) % 7
        const isWeekend = dow >= 5
        const isToday   = dateStr === TODAY
        const completed = habitLogs[h.id]?.[dateStr] === true

        if (!isFuture) { totalDays++; if (completed) completedCount++ }

        const tdCls   = [isToday ? 'hcol-today' : '', isWeekend ? 'hcol-weekend' : ''].filter(Boolean).join(' ')
        const cellCls = ['habit-cell', completed ? 'checked' : '', isFuture ? 'future' : ''].filter(Boolean).join(' ')
        const click   = isFuture ? '' : `onclick="toggleHabit('${h.id}','${dateStr}')"`

        cells += `<td class="${tdCls}"><div class="${cellCls}" ${click}></div></td>`
      }

      const pct    = totalDays > 0 ? Math.round(completedCount / totalDays * 100) : 0
      const pctCls = pct >= 80 ? 'pct-high' : pct >= 50 ? 'pct-mid' : 'pct-low'
      const pctTxt = totalDays > 0 ? pct + '%' : '—'

      return `
        <tr class="habit-row" data-id="${h.id}">
          <td class="habit-name-td">
            <div class="habit-name-cell">
              <span class="habit-name-text" title="${escHtml(h.name.toUpperCase())}">${escHtml(h.name.toUpperCase())}</span>
              <span class="habit-row-actions">
                <button class="btn-icon-sm btn-edit-habit" onclick="openRenameHabit('${h.id}')" title="Renombrar">✎</button>
                <button class="btn-icon-sm" onclick="deleteHabit('${h.id}')" title="Eliminar">✕</button>
              </span>
            </div>
          </td>
          ${cells}
          <td class="habit-success-td ${pctCls}">${pctTxt}</td>
        </tr>`
    }).join('')
  }

  container.innerHTML = `
    <div class="habits-nav">
      <button class="habit-nav-btn" onclick="navigateHabitMonth(-1)">◀</button>
      <span class="habits-month-title">${monthLabel}</span>
      <button class="habit-nav-btn" onclick="navigateHabitMonth(1)">▶</button>
    </div>
    <div class="habits-table-wrapper">
      <table class="habits-table">
        <thead>
          <tr class="habit-dow-row">${dowCells}</tr>
          <tr class="habit-day-row">${dayCells}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div class="habits-footer">
      <button class="btn-sm" onclick="openAddHabit()">+ Añadir hábito</button>
      <button class="btn-sm btn-sm-alt" onclick="openCopyFromPrev()">Copiar mes anterior</button>
    </div>
  `
}

// ── TOGGLE ─────────────────────────────────────────────────────
async function toggleHabit(habitId, dateStr) {
  const current = habitLogs[habitId]?.[dateStr] === true
  const newVal  = !current

  await db.from('habit_logs').upsert(
    { habit_id: habitId, date: dateStr, completed: newVal },
    { onConflict: 'habit_id,date' }
  )
  if (!habitLogs[habitId]) habitLogs[habitId] = {}
  habitLogs[habitId][dateStr] = newVal
  renderHabits()
}

// ── ADD HABIT ──────────────────────────────────────────────────
function openAddHabit() {
  openModal('Nuevo hábito', `
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="habit-name" placeholder="Ej: Meditar, Leer, Ejercicio…">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveHabit()">Guardar</button>
    </div>
  `)
  setTimeout(() => document.getElementById('habit-name')?.focus(), 50)
}

async function saveHabit() {
  const name = document.getElementById('habit-name')?.value?.trim()
  if (!name) return
  const maxPos = allHabits.reduce((m, h) => Math.max(m, h.position ?? 0), -1)
  const { data, error } = await db.from('habits')
    .insert({ name, year: habitYear, month: habitMonth, position: maxPos + 1 })
    .select().single()
  if (error) { console.error(error); return }
  allHabits.push(data)
  renderHabits()
  closeModal()
}

// ── RENAME ─────────────────────────────────────────────────────
function openRenameHabit(id) {
  const habit = allHabits.find(h => h.id === id)
  if (!habit) return
  openModal('Renombrar hábito', `
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="habit-rename" value="${escHtml(habit.name)}">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveRenameHabit('${id}')">Guardar</button>
    </div>
  `)
  setTimeout(() => {
    const inp = document.getElementById('habit-rename')
    inp?.focus(); inp?.select()
  }, 50)
}

async function saveRenameHabit(id) {
  const name = document.getElementById('habit-rename')?.value?.trim()
  if (!name) return
  await db.from('habits').update({ name }).eq('id', id)
  const h = allHabits.find(h => h.id === id)
  if (h) h.name = name
  renderHabits()
  closeModal()
}

// ── DELETE ─────────────────────────────────────────────────────
async function deleteHabit(id) {
  if (!confirm('¿Eliminar este hábito y sus registros?')) return
  await db.from('habits').delete().eq('id', id)
  allHabits = allHabits.filter(h => h.id !== id)
  renderHabits()
}

// ── COPY FROM PREV MONTH ───────────────────────────────────────
async function openCopyFromPrev() {
  let prevMonth = habitMonth - 1
  let prevYear  = habitYear
  if (prevMonth < 1) { prevMonth = 12; prevYear-- }

  const { data: prevHabits } = await db.from('habits')
    .select('name, position')
    .eq('year', prevYear).eq('month', prevMonth)
    .order('position')

  if (!prevHabits?.length) {
    alert('No hay hábitos en el mes anterior.')
    return
  }

  const names = prevHabits.map(h => h.name)
  openModal('Copiar hábitos del mes anterior', `
    <p style="margin-bottom:12px;color:var(--text-secondary);font-size:13px">
      Se añadirán los siguientes hábitos al mes actual:
    </p>
    <ul style="margin-bottom:16px;padding-left:16px;font-size:13px;line-height:1.9">
      ${names.map(n => `<li>${escHtml(n)}</li>`).join('')}
    </ul>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="doCopyFromPrev(${JSON.stringify(names).replace(/"/g,'&quot;')})">Copiar</button>
    </div>
  `)
}

async function doCopyFromPrev(names) {
  const maxPos = allHabits.reduce((m, h) => Math.max(m, h.position ?? 0), -1)
  const rows   = names.map((name, i) => ({
    name, year: habitYear, month: habitMonth, position: maxPos + 1 + i
  }))
  const { data, error } = await db.from('habits').insert(rows).select()
  if (error) { console.error(error); return }
  allHabits.push(...data)
  renderHabits()
  closeModal()
}
