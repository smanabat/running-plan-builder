import Papa from 'papaparse'

export type RecentWeek = { weekOffset: number; runCount: number; totalKm: number; longestKm: number }
export type CsvPreview = { weeks: RecentWeek[]; runCount: number; latestDate: string; synthetic?: boolean }

type CsvRow = Record<string, string>

function findValue(row: CsvRow, wanted: string): string {
  const key = Object.keys(row).find((candidate) => candidate.toLowerCase().trim().startsWith(wanted.toLowerCase()))
  return key ? row[key] ?? '' : ''
}

function parseMovingSeconds(raw: string): number {
  const value = raw.trim()
  if (!value) return 0
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value)
  const parts = value.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

function roundTo(value: number, increment: number): number {
  return Math.round(value / increment) * increment
}

export function parseActivityCsv(file: File): Promise<CsvPreview> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors, meta }) => {
        if (errors.length) {
          reject(new Error('The CSV could not be read. Check that you selected the original activity export.'))
          return
        }
        const headers = meta.fields?.map((field) => field.toLowerCase()) ?? []
        if (!headers.some((header) => header.includes('activity date')) || !headers.some((header) => header.includes('activity type')) || !headers.some((header) => header.includes('distance'))) {
          reject(new Error('This file is missing the Activity Date, Activity Type or Distance columns.'))
          return
        }
        const runs = data.flatMap((row) => {
          if (!/^(run|trail run|virtual run)$/i.test(findValue(row, 'activity type').trim())) return []
          const date = new Date(findValue(row, 'activity date'))
          const rawDistance = Number(findValue(row, 'distance').replaceAll(',', '').trim())
          if (!Number.isFinite(date.getTime()) || !Number.isFinite(rawDistance) || rawDistance <= 0) return []
          const distanceKm = rawDistance > 500 ? rawDistance / 1000 : rawDistance
          return [{ date, distanceKm, movingSeconds: parseMovingSeconds(findValue(row, 'moving time')) }]
        })
        if (!runs.length) {
          reject(new Error('No running activities with dates and distances were found in this CSV.'))
          return
        }
        const latest = runs.reduce((max, run) => run.date > max ? run.date : max, runs[0].date)
        const start = new Date(latest)
        start.setDate(start.getDate() - 16 * 7)
        const grouped = new Map<number, typeof runs>()
        for (const run of runs) {
          const offset = Math.floor((latest.getTime() - run.date.getTime()) / (7 * 86400000))
          if (offset < 0 || offset >= 16 || run.date < start) continue
          grouped.set(offset, [...(grouped.get(offset) ?? []), run])
        }
        const weeks = Array.from({ length: 16 }, (_, weekOffset) => {
          const activities = grouped.get(weekOffset) ?? []
          return {
            weekOffset,
            runCount: activities.length,
            totalKm: roundTo(activities.reduce((sum, run) => sum + run.distanceKm, 0), 0.5),
            longestKm: roundTo(activities.reduce((max, run) => Math.max(max, run.distanceKm), 0), 0.5),
          }
        })
        resolve({ weeks, runCount: runs.length, latestDate: latest.toISOString().slice(0, 10) })
      },
      error: () => reject(new Error('The selected CSV could not be opened.')),
    })
  })
}
