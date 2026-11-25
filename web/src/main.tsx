import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { deleteObject, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import sampleFixture from '../../fixtures/sample-training-history.json'
import { auth, db, functions, storage } from './firebase'
import { parseActivityCsv, type CsvPreview, type RecentWeek } from './csv'
import './style.css'

type Workout = { date: string; day: string; type: string; distanceKm: number; detail: string }
type PlanWeek = { weekNumber: number; startDate: string; plannedKm: number; phase: string; rationale: string; workouts: Workout[] }
type Plan = {
  id: string
  createdAt?: { toDate: () => Date }
  methodologyVersion: string
  race: { date: string; distanceKm: number; goal: string; targetTime?: string | null }
  assumptions: string[]
  weeks: PlanWeek[]
}
type ImportRecord = { id: string; uploadedAt?: { toDate: () => Date }; runCount: number; weeks: RecentWeek[]; summary: { totalKm: number } }
type GenerateResult = { planId: string }

const generatePlan = httpsCallable<Record<string, unknown>, GenerateResult>(functions, 'generateTrainingPlan')
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
const dayOptions = [
  { id: 'tue', label: 'Tue' }, { id: 'thu', label: 'Thu' }, { id: 'sat', label: 'Sat' }, { id: 'sun', label: 'Sun' }, { id: 'mon', label: 'Mon' },
]

function defaultRaceDate() {
  const date = new Date()
  date.setDate(date.getDate() + 16 * 7)
  return date.toISOString().slice(0, 10)
}

function AuthPanel() {
  const [mode, setMode] = useState<'sign-in' | 'create'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      if (mode === 'create') await createUserWithEmailAndPassword(auth, email.trim(), password)
      else await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.') }
    finally { setBusy(false) }
  }
  async function signInWithGoogle() {
    setError(''); setBusy(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : ''
      setError(code === 'auth/operation-not-allowed'
        ? 'Google sign-in is not enabled for this Firebase project yet.'
        : code === 'auth/unauthorized-domain'
          ? 'This site is not authorized for Google sign-in. Add its domain in Firebase Authentication settings.'
          : code === 'auth/account-exists-with-different-credential'
            ? 'An account with this email uses a different sign-in method. Sign in with that method first.'
            : code === 'auth/popup-blocked'
              ? 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
              : code === 'auth/popup-closed-by-user'
                ? 'Google sign-in was cancelled.'
                : err instanceof Error ? err.message : 'Could not sign in with Google.')
    } finally { setBusy(false) }
  }
  return <main className="auth-layout"><section className="auth-card">
    <div className="eyebrow">STRIDEWISE · EARLY ACCESS</div><h1>Training that fits your real life.</h1>
    <p className="muted">Build a marathon plan around your recent running, your goal and the days you can train. Every recommendation comes with its reasoning.</p>
    <button className="google-button" type="button" disabled={busy} onClick={() => void signInWithGoogle()}>
      <span className="google-mark" aria-hidden="true">G</span>Continue with Google
    </button>
    <div className="auth-divider"><span>or use email</span></div>
    <form onSubmit={submit} className="stack">
      <label>Email<input autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input autoComplete={mode === 'create' ? 'new-password' : 'current-password'} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'create' ? 'Create account' : 'Sign in'}</button>
    </form>
    <button className="text-button" type="button" disabled={busy} onClick={() => { setMode(mode === 'create' ? 'sign-in' : 'create'); setError('') }}>
      {mode === 'create' ? 'Already have an account? Sign in' : 'New here? Create an account'}
    </button>
    <p className="small muted">Sign-in is managed by Firebase Authentication. Local development uses the Auth emulator.</p>
  </section></main>
}

function UploadPanel({ user, onSummary }: { user: User; onSummary: (summary: CsvPreview | null) => void }) {
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sampleMode, setSampleMode] = useState(false)
  async function choose(next: File | null) {
    setFile(next); setPreview(null); onSummary(null); setError(''); setMessage(''); setSampleMode(false)
    if (!next) return
    if (next.size > 5 * 1024 * 1024) { setError('Choose a CSV smaller than 5 MB.'); return }
    try { const result = await parseActivityCsv(next); setPreview(result); onSummary(result) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not read this CSV.') }
  }
  async function upload() {
    if (!file || !preview) return
    setBusy(true); setError(''); setMessage('')
    const importId = crypto.randomUUID()
    const storagePath = `users/${user.uid}/imports/${importId}/source.csv`
    try {
      const sanitizedSource = new Blob([file], { type: 'text/csv' })
      await uploadBytes(ref(storage, storagePath), sanitizedSource, {
        contentType: 'text/csv',
        contentDisposition: 'attachment; filename="strava-export.csv"',
      })
      await setDoc(doc(db, 'users', user.uid, 'imports', importId), {
        fileName: 'strava-export.csv', uploadedAt: serverTimestamp(), runCount: preview.runCount,
        weeks: preview.weeks, storagePath, summary: { totalKm: preview.weeks.reduce((sum: number, week) => sum + week.totalKm, 0) },
      })
      setMessage(`Imported ${preview.runCount} runs from your export. The app uses rounded weekly summaries for plan generation.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload did not complete.')
      try { await deleteObject(ref(storage, storagePath)) } catch { /* The object may not have been created. */ }
    } finally { setBusy(false) }
  }
  function useSample() {
    const weeks = sampleFixture.history
    const result: CsvPreview = {
      weeks,
      runCount: weeks.reduce((sum, week) => sum + week.runCount, 0),
      latestDate: 'relative weeks; original dates removed',
      synthetic: true,
    }
    setFile(null); setPreview(result); onSummary(result); setSampleMode(true); setError('')
    setMessage('Synthetic sample loaded for this session. It is not uploaded or saved.')
  }
  return <section className="panel">
    <div className="section-heading"><div><div className="eyebrow">OPTIONAL · TRAINING HISTORY</div><h2>Bring your recent runs</h2></div><span className="badge">CSV upload</span></div>
    <p className="muted">Choose a Strava account export. We parse running dates and distances in your browser, then send rounded weekly totals to the planner.</p>
    <label className="file-picker">Select activity CSV<input type="file" accept=".csv,text/csv" onChange={(e) => void choose(e.target.files?.[0] ?? null)} /></label>
    <button className="text-button" type="button" onClick={useSample}>Try a synthetic sample instead</button>
    {preview && <div className="preview"><strong>{preview.synthetic ? `Synthetic sample · ${preview.runCount} example runs` : `${preview.runCount} running activities found`}</strong><span>{preview.weeks.filter((w) => w.runCount).length} active weeks · {preview.synthetic ? 'calendar dates removed' : `most recent activity ${preview.latestDate}`}</span><span>{preview.synthetic ? 'All sample values are invented for demonstration.' : 'Weekly totals are rounded to the nearest 0.5 km.'}</span></div>}
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <div className="privacy-note"><strong>Privacy:</strong> the source CSV is stored in your private account space in the local Storage emulator. It includes original details; delete it after you finish experimenting. Do not use a production account here.</div>
    {sampleMode ? <button className="secondary" onClick={() => setMessage('Sample is ready. Generate a plan to use its weekly training history.')}>Sample ready for plan generation</button>
      : <button className="secondary" disabled={!preview || busy} onClick={() => void upload()}>{busy ? 'Uploading…' : 'Upload and save training summary'}</button>}
  </section>
}

function PlanForm({ user, importRecord }: { user: User; importRecord: ImportRecord | null }) {
  const [raceDate, setRaceDate] = useState(defaultRaceDate())
  const [availableDays, setAvailableDays] = useState(['tue', 'thu', 'sat', 'sun'])
  const [experience, setExperience] = useState<'new' | 'some' | 'experienced'>('some')
  const [weeklyKm, setWeeklyKm] = useState('25')
  const [goal, setGoal] = useState<'finish' | 'time'>('finish')
  const [targetTime, setTargetTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  function toggleDay(day: string) {
    setAvailableDays((days) => days.includes(day) ? days.filter((value) => value !== day) : [...days, day])
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await generatePlan({
        raceDate, availableDays, experience, weeklyKm: Number(weeklyKm), goal,
        targetTime: goal === 'time' ? targetTime : undefined,
        recentWeeks: importRecord?.weeks ?? [],
      })
      await setDoc(doc(db, 'users', user.uid), { updatedAt: serverTimestamp() }, { merge: true })
      setMessage(`Plan created (${result.data.planId.slice(0, 8)}). It is saved below.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'The plan could not be created.') }
    finally { setBusy(false) }
  }
  return <section className="panel">
    <div className="eyebrow">YOUR GOAL</div><h2>Set up a marathon plan</h2>
    <p className="muted">This prototype generates a schedule, not a promise of a finish time. It does not provide medical or injury advice.</p>
    <form onSubmit={submit} className="form-grid">
      <label>Race date<input type="date" required value={raceDate} onChange={(e) => setRaceDate(e.target.value)} /></label>
      <label>Current typical weekly distance (km)<input type="number" min="0" max="160" step="1" required value={weeklyKm} onChange={(e) => setWeeklyKm(e.target.value)} /></label>
      <label>Running experience<select value={experience} onChange={(e) => setExperience(e.target.value as typeof experience)}><option value="new">New to structured training</option><option value="some">Some race training experience</option><option value="experienced">Experienced marathon runner</option></select></label>
      <fieldset className="day-field"><legend>Days you can usually run · choose 3–5</legend><div className="day-options">{dayOptions.map((day) => <label key={day.id} className={availableDays.includes(day.id) ? 'day-option selected' : 'day-option'}><input type="checkbox" checked={availableDays.includes(day.id)} onChange={() => toggleDay(day.id)} />{day.label}</label>)}</div></fieldset>
      <fieldset className="goal-field"><legend>Your goal</legend><div className="radio-row"><label><input type="radio" checked={goal === 'finish'} onChange={() => setGoal('finish')} />Complete the race</label><label><input type="radio" checked={goal === 'time'} onChange={() => setGoal('time')} />Work toward a time</label></div>{goal === 'time' && <input aria-label="Target time" placeholder="e.g. 3:45" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} required />}</fieldset>
      {error && <p role="alert" className="error full-row">{error}</p>}{message && <p role="status" className="success full-row">{message}</p>}
      <button className="primary full-row" disabled={busy || availableDays.length < 3 || availableDays.length > 5}>{busy ? 'Building your plan…' : 'Generate my plan'}</button>
    </form>
    <p className="small muted">The plan uses versioned prototype rules. Review the assumptions before relying on it for training decisions.</p>
  </section>
}

function PlanCard({ plan }: { plan: Plan }) {
  return <article className="panel plan-card">
    <div className="section-heading"><div><div className="eyebrow">MARATHON · {plan.race.date}</div><h2>{plan.weeks.length}-week plan</h2></div><span className="badge">Rules {plan.methodologyVersion}</span></div>
    <div className="assumptions"><strong>What this plan assumes</strong><ul>{plan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div>
    <div className="week-list">{plan.weeks.map((week) => <details className="week" key={week.weekNumber} open={week.weekNumber === 1}>
      <summary><span><strong>Week {week.weekNumber}</strong><small>{new Date(`${week.startDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span><span className="week-meta">{week.phase} · {week.plannedKm} km planned</span></summary>
      <p className="week-rationale">{week.rationale}</p>
      <ul className="workout-list">{week.workouts.map((workout, index) => <li key={`${workout.date}-${index}`}><div><strong>{workout.day} · {workout.type}</strong><small>{workout.distanceKm} km · {workout.detail}</small></div></li>)}</ul>
    </details>)}</div>
  </article>
}

function Dashboard({ user }: { user: User }) {
  const [importRecords, setImportRecords] = useState<ImportRecord[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [summary, setSummary] = useState<CsvPreview | null>(null)
  const [notice, setNotice] = useState('')
  const importRecord = importRecords[0] ?? null
  useEffect(() => {
    const importsQuery = query(collection(db, 'users', user.uid, 'imports'), orderBy('uploadedAt', 'desc'))
    const plansQuery = query(collection(db, 'users', user.uid, 'plans'), orderBy('createdAt', 'desc'))
    const stopImports = onSnapshot(importsQuery, (snap) => setImportRecords(snap.docs.map((item) => ({ id: item.id, ...item.data() } as ImportRecord))))
    const stopPlans = onSnapshot(plansQuery, (snap) => setPlans(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Plan))))
    void setDoc(doc(db, 'users', user.uid), { displayName: user.email?.split('@')[0] ?? 'Runner', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })
    return () => { stopImports(); stopPlans() }
  }, [user])
  const weeklySummary = useMemo(() => summary ?? (importRecord ? { weeks: importRecord.weeks, runCount: importRecord.runCount, latestDate: '' } : null), [summary, importRecord])
  async function deleteImport(item: ImportRecord) {
    if (!window.confirm('Delete this uploaded CSV and its saved training summary?')) return
    try {
      await deleteObject(ref(storage, `users/${user.uid}/imports/${item.id}/source.csv`))
      await deleteDoc(doc(db, 'users', user.uid, 'imports', item.id))
      setNotice('The uploaded file and summary were deleted.')
    } catch (err) { setNotice(err instanceof Error ? `Delete failed: ${err.message}` : 'Delete failed.') }
  }
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">S</span><span>stridewise<small>RUNNING PLAN BUILDER</small></span></a><div className="account"><span>{user.email}</span><button className="text-button" onClick={() => void signOut(auth)}>Sign out</button></div></header>
    <section className="hero" id="top"><div><div className="eyebrow light">YOUR TRAINING, MADE CLEARER</div><h1>A plan built around<br />your real running.</h1><p>Start with a goal, your available days and recent training. See what the plan recommends—and why.</p></div><div className="hero-mark" aria-hidden="true">↗</div></section>
    <div className="content-grid">
      <div className="left-column"><UploadPanel user={user} onSummary={setSummary} />
        {importRecords.map((item) => <section className="import-row" key={item.id}><div><strong>Saved activity history</strong><span>{item.runCount} runs · {item.weeks.filter((w) => w.runCount > 0).length} active weeks. Only weekly totals are used by the planner.</span></div><button className="text-button danger" onClick={() => void deleteImport(item)}>Delete upload</button></section>)}
      </div>
      <div className="right-column"><PlanForm key={importRecord?.id ?? 'no-import'} user={user} importRecord={weeklySummary ? { id: importRecord?.id ?? 'preview', runCount: weeklySummary.runCount, weeks: weeklySummary.weeks, summary: { totalKm: weeklySummary.weeks.reduce((sum, week) => sum + week.totalKm, 0) } } : null} /></div>
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="plans-section"><div className="eyebrow">YOUR SAVED PLANS</div><h2>Training plans</h2>{plans.length ? plans.map((plan) => <PlanCard key={plan.id} plan={plan} />) : <div className="empty-state"><div className="empty-icon">↗</div><strong>Your first plan will show up here.</strong><span>Plans include the schedule, rationale and assumptions used to create them.</span></div>}</section>
    <footer className="app-footer"><span>Stridewise · local product prototype</span><span>General training guidance only · not medical advice</span></footer>
  </main>
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => onAuthStateChanged(auth, (next) => { setUser(next); setLoading(false) }), [])
  if (loading) return <div className="loading">Loading your workspace…</div>
  return user ? <Dashboard user={user} /> : <AuthPanel />
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
