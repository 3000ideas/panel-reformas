const SUPABASE_URL = 'https://rjyulnmjwkgiqekbwuzs.supabase.co'
const SUPABASE_KEY = 'sb_publishable_HFAmCAD5mdLXuspPr2iZZg_sWooO0lu'
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const TODAY = new Date().toISOString().split('T')[0]

function getWeekRange() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}
