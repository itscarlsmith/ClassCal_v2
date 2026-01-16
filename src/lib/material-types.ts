const MATERIAL_TYPE_VALUES = [
  'document',
  'image',
  'video',
  'link',
  'flashcard',
  'quiz',
  'worksheet',
] as const

export type MaterialType = (typeof MATERIAL_TYPE_VALUES)[number]

const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  document: 'Document',
  image: 'Image',
  video: 'Video',
  link: 'External Link',
  flashcard: 'Flashcards',
  quiz: 'Quiz',
  worksheet: 'Worksheet',
}

/**
 * Maps legacy or unknown material type values to the supported conceptual set.
 * Currently only `pdf` needs to normalize to `document`, but this guard also
 * future-proofs against empty / unexpected values.
 */
export function normalizeMaterialType(type?: string | null): MaterialType {
  if (!type) return 'document'
  const normalized = type.toLowerCase()
  if (normalized === 'pdf') {
    return 'document'
  }

  return (MATERIAL_TYPE_VALUES.includes(normalized as MaterialType)
    ? (normalized as MaterialType)
    : 'document')
}

export function getMaterialTypeLabel(type?: string | null): string {
  const normalized = normalizeMaterialType(type)
  return MATERIAL_TYPE_LABELS[normalized]
}

export const MATERIAL_TYPE_OPTIONS = MATERIAL_TYPE_VALUES.map((value) => ({
  value,
  label: MATERIAL_TYPE_LABELS[value],
}))


