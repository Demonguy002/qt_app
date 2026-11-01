export const STORAGE_KEY = 'quant-aptitude-coach-v2';
const LEGACY_STORAGE_KEY = 'quant-aptitude-coach-v1';

export const emptyState = {
  profile: null,
  records: [],
  activeSession: null,
  theme: 'light',
  attemptedIds: [],
};

export function readLocalState() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (current && typeof current === 'object') return { ...emptyState, ...current };
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    if (legacy && typeof legacy === 'object') {
      // Keep the learner profile and theme, but discard attempts made with the
      // previous unverified OCR bank so old incorrect scores cannot contaminate progress.
      return { ...emptyState, profile: legacy.profile || null, theme: legacy.theme || 'light' };
    }
    return emptyState;
  } catch {
    return emptyState;
  }
}

export function writeLocalState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) {
    console.warn('Could not persist local practice state', error);
  }
}

export function kolkataDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function dateDiff(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const utcA = Date.UTC(ay, am - 1, ad);
  const utcB = Date.UTC(by, bm - 1, bd);
  return Math.round((utcB - utcA) / 86400000);
}

export function recalculateStreaks(records) {
  const sorted = [...records].filter(r => r.completed).sort((a, b) => a.date.localeCompare(b.date));
  let previousDate = null;
  let previousValue = 0;
  let longest = 0;
  const patched = new Map();
  for (const record of sorted) {
    let value;
    if (!previousDate) value = 1;
    else value = dateDiff(previousDate, record.date) === 1 ? previousValue + 1 : 0;
    longest = Math.max(longest, value);
    previousDate = record.date;
    previousValue = value;
    patched.set(record.date, { ...record, streakValue: value, longestStreak: longest });
  }
  return records.map(r => patched.get(r.date) || r).sort((a, b) => a.date.localeCompare(b.date));
}

export function currentStreak(records, today = kolkataDate()) {
  const completed = [...records].filter(r => r.completed).sort((a, b) => b.date.localeCompare(a.date));
  if (!completed.length) return 0;
  const latest = completed[0];
  const daysOld = dateDiff(latest.date, today);
  if (daysOld > 1 || daysOld < 0) return 0;
  return latest.streakValue || 0;
}

export function longestStreak(records) {
  return Math.max(0, ...records.filter(r => r.completed).map(r => r.streakValue || 0));
}

export function formatDuration(seconds = 0) {
  const n = Math.max(0, Math.round(seconds));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

export function formatDate(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'Asia/Kolkata' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
