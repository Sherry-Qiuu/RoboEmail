import { existsSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

/**
 * Rich teacher profiles (research interests, photo, publications) that the
 * directory seed does not carry. They are shipped as a JSON bundle built by
 * `scripts/import_profiles.py` and joined to the database rows at request time,
 * so an existing database needs no migration.
 */
export type ProfilePaper = {
  title: string
  doi: string
  pure: string
  year: string
  venue: string
  type: string
}

export type ProfileRow = {
  id: number
  faculty: string
  name: string
  title: string
  titleCn: string
  dept: string
  deptCn: string
  email: string
  research: string
  photo: string
  profile: string
  pure: string
  papers: ProfilePaper[]
}

const DATA_FILE = resolve(import.meta.dirname, '../assets/profiles.json')
const PHOTO_DIR = resolve(import.meta.dirname, '../assets/photos')

/** "Dr. Molin Li" and "Molin Li" are the same person. */
const HONORIFIC = /^(dr|prof|professor|mr|ms|mrs|miss)\.?\s+/i

export function nameKey(value: string): string {
  return value
    .replace(HONORIFIC, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type Index = {
  byEmail: Map<string, ProfileRow>
  byName: Map<string, ProfileRow>
}

let index: Index | null = null

function load(): Index {
  if (index) return index

  const empty: Index = { byEmail: new Map(), byName: new Map() }
  let rows: ProfileRow[]
  try {
    rows = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as ProfileRow[]
  } catch (error) {
    console.warn('[profiles] bundle unreadable:', (error as Error).message)
    index = empty
    return index
  }

  const byEmail = new Map<string, ProfileRow>()
  const byName = new Map<string, ProfileRow>()
  for (const row of rows) {
    if (row.email) byEmail.set(row.email.trim().toLowerCase(), row)
    const key = nameKey(row.name)
    if (key) byName.set(key, row)
  }

  console.log(`[profiles] loaded ${rows.length} profiles`)
  index = { byEmail, byName }
  return index
}

/**
 * Email first: it is the one field both sources copy verbatim. Names are the
 * fallback because the directory sometimes stores a longer or shorter form.
 */
export function profileFor(row: { name_en: string; email: string | null }): ProfileRow | null {
  const { byEmail, byName } = load()
  const email = row.email?.trim().toLowerCase()
  if (email) {
    const hit = byEmail.get(email)
    if (hit) return hit
  }
  return byName.get(nameKey(row.name_en)) ?? null
}

export function photoPath(profile: ProfileRow): string | null {
  if (!profile.photo) return null
  const file = resolve(PHOTO_DIR, profile.photo)
  // The bundle is ours, but a path escape here would be a file disclosure bug.
  if (!file.startsWith(PHOTO_DIR + sep)) return null
  return existsSync(file) ? file : null
}

export function toPublicProfile(profile: ProfileRow, professorId: string) {
  return {
    name: profile.name,
    faculty: profile.faculty,
    titleEn: profile.title,
    titleCn: profile.titleCn,
    dept: profile.dept,
    deptCn: profile.deptCn,
    email: profile.email,
    research: profile.research,
    photoUrl: profile.photo ? `/api/professors/${professorId}/photo` : '',
    profileUrl: profile.profile,
    pureUrl: profile.pure,
    papers: profile.papers,
  }
}
