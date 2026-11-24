import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()
const db = getFirestore()
const methodologyVersion = '0.1.0-prototype'
const weekMs = 7 * 24 * 60 * 60 * 1000

type RecentWeek = { weekOffset: number; runCount: number; totalKm: number; longestKm: number }
type Request = {
  raceDate: string
  availableDays: string[]
  experience: 'new' | 'some' | 'experienced'
  weeklyKm: number
  goal: 'finish' | 'time'
  targetTime?: string
  recentWeeks?: RecentWeek[]
}

const dayNames: Record<string, string> = { tue: 'Tuesday', thu: 'Thursday', sat: 'Saturday', sun: 'Sunday', mon: 'Monday', wed: 'Wednesday', fri: 'Friday' }
const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function finiteNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function validateRequest(value: unknown): Request {
  if (!value || typeof value !== 'object') throw new HttpsError('invalid-argument', 'Plan details are required.')
  const input = value as Partial<Request>
  if (typeof input.raceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.raceDate)) {
    throw new HttpsError('invalid-argument', 'Choose a valid race date.')
  }
  const raceDate = new Date(`${input.raceDate}T12:00:00.000Z`)
  const daysUntilRace = (raceDate.getTime() - Date.now()) / 86400000
  if (!Number.isFinite(raceDate.getTime()) || raceDate.toISOString().slice(0, 10) !== input.raceDate || daysUntilRace < 42 || daysUntilRace > 210) {
    throw new HttpsError('invalid-argument', 'For this prototype, choose a race date 6 to 30 weeks from today.')
  }
  if (!Array.isArray(input.availableDays) || input.availableDays.length < 3 || input.availableDays.length > 5
    || new Set(input.availableDays).size !== input.availableDays.length
    || input.availableDays.some((day) => typeof day !== 'string' || !dayOrder.includes(day))) {
    throw new HttpsError('invalid-argument', 'Choose 3 to 5 available running days.')
  }
  if (!['new', 'some', 'experienced'].includes(input.experience ?? '')) throw new HttpsError('invalid-argument', 'Choose a running experience level.')
  if (!finiteNumber(input.weeklyKm, 0, 160)) throw new HttpsError('invalid-argument', 'Weekly running distance must be between 0 and 160 km.')
  if (!['finish', 'time'].includes(input.goal ?? '')) throw new HttpsError('invalid-argument', 'Choose a goal type.')
  if (input.goal === 'time' && (typeof input.targetTime !== 'string' || input.targetTime.length > 40)) {
    throw new HttpsError('invalid-argument', 'Add a short target-time description.')
  }
  if (input.recentWeeks !== undefined && (!Array.isArray(input.recentWeeks) || input.recentWeeks.length > 16)) {
    throw new HttpsError('invalid-argument', 'Provide no more than 16 recent weekly summaries.')
  }
  for (const week of input.recentWeeks ?? []) {
    if (!Number.isInteger(week.weekOffset) || week.weekOffset < 0 || week.weekOffset > 15
      || !Number.isInteger(week.runCount) || !finiteNumber(week.runCount, 0, 20)
      || !finiteNumber(week.totalKm, 0, 250) || !finiteNumber(week.longestKm, 0, 80)) {
      throw new HttpsError('invalid-argument', 'One of the weekly activity summaries is invalid.')
    }
  }
  if (JSON.stringify(value).length > 12000) throw new HttpsError('invalid-argument', 'The training summary is too large.')
  return input as Request
}

function buildSchedule(input: Request, now: Date) {
  const race = new Date(`${input.raceDate}T12:00:00.000Z`)
  const weeks = Math.max(6, Math.min(30, Math.ceil((race.getTime() - now.getTime()) / weekMs)))
  const selectedDays = [...input.availableDays].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
  const longDay = selectedDays.includes('sun') ? 'sun' : selectedDays[selectedDays.length - 1]
  const qualityDay = selectedDays.find((day) => ['tue', 'wed', 'thu'].includes(day)) ?? selectedDays[0]
  const recent = (input.recentWeeks ?? []).filter((week) => finiteNumber(week.totalKm, 0, 250) && finiteNumber(week.runCount, 0, 20))
  const measured = recent.filter((week) => week.weekOffset <= 5 && week.weekOffset >= 0)
  const consistentWeeks = measured.filter((week) => week.runCount > 0)
  const evidenceKm = consistentWeeks.length
    ? consistentWeeks.reduce((sum, week) => sum + week.totalKm, 0) / consistentWeeks.length
    : input.weeklyKm
  const startKm = Math.max(8, Math.min(input.weeklyKm || evidenceKm || 12, evidenceKm || input.weeklyKm || 12))
  const capKm = Math.max(startKm, Math.min(70, Math.max(startKm, evidenceKm) * 1.35))
  const runCount = selectedDays.length
  const raceStart = new Date(Date.UTC(race.getUTCFullYear(), race.getUTCMonth(), race.getUTCDate() - ((race.getUTCDay() + 6) % 7), 12))

  return Array.from({ length: weeks }, (_, index) => {
    const weekNumber = index + 1
    const isRaceWeek = index === weeks - 1
    const isTaper = index >= weeks - 3 && !isRaceWeek
    const isRecovery = weekNumber % 4 === 0
    const progression = startKm + Math.max(0, index - 1) * Math.max(1, startKm * 0.045)
    const peakDistance = Math.min(capKm, progression)
    const plannedKm = isRaceWeek ? Math.min(18, Math.round(startKm * 0.45))
      : isTaper ? Math.round(peakDistance * (index === weeks - 2 ? 0.7 : 0.85))
        : isRecovery ? Math.round(peakDistance * 0.78) : Math.round(peakDistance)
    const longKm = Math.min(isRaceWeek ? 8 : 30, Math.round(plannedKm * (runCount === 3 ? 0.42 : 0.38)))
    const qualityKm = Math.max(3, Math.round((plannedKm - longKm) / (runCount - 1)))
    const weekDate = new Date(raceStart.getTime() - (weeks - 1 - index) * weekMs)
    const workouts = selectedDays.map((day) => {
      const date = new Date(weekDate.getTime() + dayOrder.indexOf(day) * 86400000)
      const isLong = day === longDay
      const isQuality = day === qualityDay && !isLong && weekNumber > 2 && !isRecovery && !isTaper
      const distanceKm = isLong ? longKm : Math.max(3, qualityKm)
      const type = isLong ? 'Easy long run' : isQuality ? 'Controlled quality session' : 'Easy run'
      const detail = isLong
        ? 'Keep the effort conversational. Shorten or skip if you are not recovering well.'
        : isQuality
          ? 'Prototype session: include a comfortable warm-up and cool-down; keep effort controlled.'
          : 'Run at a conversational effort. Rest or cross-train on other days.'
      return { date: date.toISOString().slice(0, 10), day: dayNames[day], type, distanceKm, detail }
    })
    const scheduledWorkouts = isRaceWeek ? workouts.filter((workout) => workout.date < input.raceDate) : workouts
    return {
      weekNumber,
      startDate: weekDate.toISOString().slice(0, 10),
      plannedKm,
      phase: isRaceWeek ? 'Race week' : isTaper ? 'Taper' : isRecovery ? 'Recovery' : 'Build',
      rationale: isRaceWeek ? 'Reduce training before the goal event.' : isTaper ? 'Reduce volume to prioritize freshness.' : isRecovery ? 'A lighter week is built in to reduce accumulated load.' : 'Build gradually from the starting estimate while keeping most running easy.',
      workouts: isRaceWeek ? [...scheduledWorkouts, { date: input.raceDate, day: 'Race day', type: 'Marathon event', distanceKm: 42.2, detail: 'Race-day distance is shown separately from planned training volume.' }] : scheduledWorkouts,
    }
  })
}

export const generateTrainingPlan = onCall({ region: 'northamerica-northeast1', maxInstances: 5 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before generating a plan.')
  const input = validateRequest(request.data)
  const now = new Date()
  const schedule = buildSchedule(input, now)
  const ref = db.collection('users').doc(request.auth.uid).collection('plans').doc()
  const importedWeeks = input.recentWeeks ?? []
  const plan = {
    id: ref.id,
    createdAt: Timestamp.now(),
    methodologyVersion,
    race: { date: input.raceDate, distanceKm: 42.2, goal: input.goal, targetTime: input.targetTime ?? null },
    preferences: { availableDays: input.availableDays, experience: input.experience, weeklyKm: input.weeklyKm },
    dataSummary: { weeksReceived: importedWeeks.length, recentRunCount: importedWeeks.reduce((sum, week) => sum + week.runCount, 0) },
    assumptions: [
      'This is an early prototype schedule, not a coach-reviewed training prescription.',
      'Activity history cannot show recovery, injury status, terrain or life stress.',
      'Pace targets are not set because the prototype does not yet validate a recent race or threshold result.',
      'Experience level is recorded but does not yet change the generated schedule.',
      input.goal === 'time' ? `Target time supplied: ${input.targetTime}. This version does not calculate or promise a finish time.` : 'The plan is oriented toward completing the event, not a guaranteed result.',
    ],
    weeks: schedule,
  }
  await ref.set(plan)
  return { planId: ref.id }
})
