export type DraftSelectOption = {
  label: string
  value: string
}

export type DraftField = {
  id: string
  label: string
  type: string
  required: boolean
  options: DraftSelectOption[]
}

export type DraftSection = {
  id: string
  title: string
  description: string
  fields: DraftField[]
}

export type DraftDocument = {
  id: string
  name: string
  required: boolean
  maxSizeMb: number
}

export type PublicFormDraft = {
  config: {
    name: string
    year: string
    tenantSlug: string
    startsOn: string
    endsOn: string
    autosave: boolean
    progressBar: boolean
  }
  sections: DraftSection[]
  documents: DraftDocument[]
  versionStatus: 'draft' | 'published'
  updatedAt: string
}

const draftStorageKey = (tenantSlug: string, year: string) => `ofir.public-form.${tenantSlug}.${year}`

export const savePublicFormDraft = (draft: PublicFormDraft) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(draftStorageKey(draft.config.tenantSlug, draft.config.year), JSON.stringify(draft))
}

export const loadPublicFormDraft = (tenantSlug: string, year: string): PublicFormDraft | null => {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(draftStorageKey(tenantSlug, year))
  if (!raw) return null

  try {
    return JSON.parse(raw) as PublicFormDraft
  } catch {
    return null
  }
}
