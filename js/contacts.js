// ── STATE ──────────────────────────────────────────────────────
let allContacts      = []
let contactsExpanded = false
const CONTACTS_LIMIT = 5

// Historial paginado
let _historyData     = []  // todos los registros del contacto abierto
let _historyPage     = 0   // página actual (0 = más recientes)
const HISTORY_PER_PAGE = 3

// ── LOAD ───────────────────────────────────────────────────────
async function loadContacts() {
  const { data, error } = await db.from('contacts').select('*')
  if (error) { console.error(error); return }
  allContacts = data || []
  renderContacts()
}

// ── URGENCIA ───────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return null
  const last  = new Date(dateStr + 'T00:00:00')
  const today = new Date(TODAY   + 'T00:00:00')
  return Math.floor((today - last) / 86400000)
}

function sortScore(c) {
  if (!c.frequency_days)    return -1
  if (!c.last_contact_date) return 9999
  return daysSince(c.last_contact_date) / c.frequency_days
}

function urgencyDot(c) {
  if (!c.frequency_days)    return '<span class="udot udot-grey" title="Sin recordatorio"></span>'
  if (!c.last_contact_date) return '<span class="udot udot-red"  title="Sin registro"></span>'
  const ratio = daysSince(c.last_contact_date) / c.frequency_days
  if (ratio >= 1)   return '<span class="udot udot-red"    title="Vencido"></span>'
  if (ratio >= 0.7) return '<span class="udot udot-yellow" title="Próximamente"></span>'
  return               '<span class="udot udot-green"  title="Al día"></span>'
}

function sortedContacts() {
  return [...allContacts].sort((a, b) => sortScore(b) - sortScore(a))
}

// ── RENDER LISTA ───────────────────────────────────────────────
function renderContacts() {
  const ul = document.getElementById('list-contacts')
  if (!allContacts.length) {
    ul.innerHTML = '<li class="empty">Sin contactos</li>'
    return
  }

  const sorted  = sortedContacts()
  const visible = contactsExpanded ? sorted : sorted.slice(0, CONTACTS_LIMIT)
  const hasMore = sorted.length > CONTACTS_LIMIT

  ul.innerHTML = visible.map(c => {
    const days = daysSince(c.last_contact_date)
    let daysText
    if      (days === null) daysText = 'Sin registro'
    else if (days === 0)    daysText = 'Hoy'
    else if (days === 1)    daysText = 'Ayer'
    else                    daysText = `hace ${days}d`

    const freqText = c.frequency_days ? ` · cada ${c.frequency_days}d` : ''

    return `
      <li class="contact-item" onclick="openEditContact('${c.id}')">
        <div class="contact-compact-row">
          ${urgencyDot(c)}
          <span class="contact-name">${escHtml(c.name)}</span>
          ${c.label ? `<span class="contact-label">${escHtml(c.label)}</span>` : ''}
          <span class="contact-days">${daysText}${freqText}</span>
          <button class="btn-contact-now"
            onclick="event.stopPropagation();openQuickContact('${c.id}')"
            title="Registrar contacto hoy">✓</button>
        </div>
      </li>`
  }).join('')

  if (hasMore) {
    const li = document.createElement('li')
    li.className = 'contacts-show-more'
    li.innerHTML = contactsExpanded
      ? `<button onclick="toggleContactsExpanded()">Mostrar menos ▲</button>`
      : `<button onclick="toggleContactsExpanded()">+ ${sorted.length - CONTACTS_LIMIT} más ▼</button>`
    ul.appendChild(li)
  }
}

function toggleContactsExpanded() {
  contactsExpanded = !contactsExpanded
  renderContacts()
}

// ── QUICK CONTACT ──────────────────────────────────────────────
function openQuickContact(id) {
  const c = allContacts.find(x => x.id === id)
  if (!c) return
  openModal(`✓ ${escHtml(c.name)}`, `
    <p class="quick-contact-hint">Registrar contacto a fecha de hoy</p>
    <div class="form-group">
      <label>Asunto (opcional)</label>
      <input type="text" id="quick-subject" placeholder="De qué hablasteis…">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary"   onclick="saveQuickContact('${id}')">Registrar</button>
    </div>
  `)
  setTimeout(() => document.getElementById('quick-subject')?.focus(), 50)
}

async function saveQuickContact(id) {
  const subject = document.getElementById('quick-subject')?.value?.trim() || null
  const update  = { last_contact_date: TODAY, last_contact_subject: subject }

  await Promise.all([
    db.from('contacts').update(update).eq('id', id),
    db.from('contact_history').insert({ contact_id: id, date: TODAY, subject })
  ])

  const c = allContacts.find(x => x.id === id)
  if (c) Object.assign(c, update)
  renderContacts()
  closeModal()
}

// ── HISTORIAL PAGINADO ─────────────────────────────────────────
function renderHistory() {
  const container = document.getElementById('history-paginated')
  if (!container) return

  const total      = _historyData.length
  const totalPages = Math.ceil(total / HISTORY_PER_PAGE)
  const start      = _historyPage * HISTORY_PER_PAGE
  const items      = _historyData.slice(start, start + HISTORY_PER_PAGE)

  const canPrev = _historyPage > 0               // hay más recientes
  const canNext = _historyPage < totalPages - 1  // hay más antiguos

  container.innerHTML = `
    <div class="history-paginator">
      <button class="history-arrow" onclick="navHistory(-1)"
        ${canPrev ? '' : 'disabled'} title="Más recientes">◀</button>
      <div class="history-items">
        ${items.map(h => `
          <div class="history-item">
            <span class="history-date">${formatDate(h.date)}</span>
            <span class="history-subject">${h.subject ? escHtml(h.subject) : '<em>Sin asunto</em>'}</span>
          </div>`).join('')}
      </div>
      <button class="history-arrow" onclick="navHistory(1)"
        ${canNext ? '' : 'disabled'} title="Más antiguos">▶</button>
    </div>
    ${totalPages > 1 ? `<p class="history-pages">Pág. ${_historyPage + 1} / ${totalPages}</p>` : ''}
  `
}

function navHistory(dir) {
  const totalPages = Math.ceil(_historyData.length / HISTORY_PER_PAGE)
  _historyPage = Math.max(0, Math.min(totalPages - 1, _historyPage + dir))
  renderHistory()
}

// ── FORMULARIO ─────────────────────────────────────────────────
const FREQ_OPTIONS = [
  { v: 7,   l: 'Cada semana'    },
  { v: 14,  l: 'Cada 2 semanas' },
  { v: 21,  l: 'Cada 3 semanas' },
  { v: 30,  l: 'Cada mes'       },
  { v: 60,  l: 'Cada 2 meses'   },
  { v: 90,  l: 'Cada 3 meses'   },
  { v: 180, l: 'Cada 6 meses'   },
  { v: 365, l: 'Cada año'       },
]

function contactForm(c = {}, hasHistory = false) {
  return `
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="contact-name"
        value="${escHtml(c.name || '')}" placeholder="Nombre completo">
    </div>
    <div class="form-row-2">
      <div class="form-group">
        <label>Etiqueta</label>
        <input type="text" id="contact-label"
          value="${escHtml(c.label || '')}" placeholder="amigo, trabajo, familia…">
      </div>
      <div class="form-group">
        <label>Recordarme contactar</label>
        <select id="contact-frequency">
          <option value="">Sin recordatorio</option>
          ${FREQ_OPTIONS.map(o =>
            `<option value="${o.v}" ${c.frequency_days == o.v ? 'selected' : ''}>${o.l}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row-2">
      <div class="form-group">
        <label>Último contacto</label>
        <input type="date" id="contact-date" value="${c.last_contact_date || ''}">
      </div>
      <div class="form-group">
        <label>Asunto</label>
        <input type="text" id="contact-subject"
          value="${escHtml(c.last_contact_subject || '')}" placeholder="De qué hablasteis">
      </div>
    </div>
    <div class="form-group">
      <label>Notas</label>
      <textarea id="contact-notes" placeholder="Notas libres…">${escHtml(c.notes || '')}</textarea>
    </div>
    ${hasHistory ? `
      <div class="form-group">
        <label>Historial</label>
        <div id="history-paginated"></div>
      </div>` : ''}
    <div class="form-actions">
      ${c.id ? `<button class="btn btn-secondary btn-danger-soft" onclick="deleteContact('${c.id}')">Eliminar</button>` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary"   onclick="saveContact('${c.id || ''}')">Guardar</button>
    </div>
  `
}

// ── ADD / EDIT ─────────────────────────────────────────────────
function openAddContact() {
  _historyData = []
  _historyPage = 0
  openModal('Nuevo contacto', contactForm())
  setTimeout(() => document.getElementById('contact-name')?.focus(), 50)
}

async function openEditContact(id) {
  const c = allContacts.find(x => x.id === id)
  if (!c) return

  // Cargar TODO el historial sin límite
  const { data: history } = await db.from('contact_history')
    .select('*').eq('contact_id', id)
    .order('date', { ascending: false })

  _historyData = history || []
  _historyPage = 0

  openModal('Editar contacto', contactForm(c, _historyData.length > 0))
  setTimeout(() => {
    document.getElementById('contact-name')?.focus()
    if (_historyData.length) renderHistory()
  }, 50)
}

// ── GUARDAR CONTACTO ───────────────────────────────────────────
async function saveContact(id) {
  const payload = {
    name:                 document.getElementById('contact-name')?.value?.trim(),
    label:                document.getElementById('contact-label')?.value?.trim()       || null,
    frequency_days:       parseInt(document.getElementById('contact-frequency')?.value) || null,
    last_contact_date:    document.getElementById('contact-date')?.value                || null,
    last_contact_subject: document.getElementById('contact-subject')?.value?.trim()    || null,
    notes:                document.getElementById('contact-notes')?.value?.trim()      || null,
  }
  if (!payload.name) return

  if (id) {
    const existing = allContacts.find(c => c.id === id)

    // Si cambió la fecha de último contacto → insertar en historial
    const dateChanged = payload.last_contact_date &&
                        payload.last_contact_date !== existing?.last_contact_date
    const ops = [db.from('contacts').update(payload).eq('id', id)]
    if (dateChanged) {
      ops.push(db.from('contact_history').insert({
        contact_id: id,
        date:       payload.last_contact_date,
        subject:    payload.last_contact_subject || null,
      }))
    }
    await Promise.all(ops)

    const idx = allContacts.findIndex(c => c.id === id)
    if (idx !== -1) allContacts[idx] = { ...allContacts[idx], ...payload }
  } else {
    const { data, error } = await db.from('contacts').insert(payload).select().single()
    if (error) { console.error(error); return }
    allContacts.push(data)
  }

  renderContacts()
  closeModal()
}

// ── ELIMINAR ───────────────────────────────────────────────────
async function deleteContact(id) {
  if (!confirm('¿Eliminar este contacto?')) return
  await db.from('contacts').delete().eq('id', id)
  allContacts = allContacts.filter(c => c.id !== id)
  renderContacts()
  closeModal()
}
