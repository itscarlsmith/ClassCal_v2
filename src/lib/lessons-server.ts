import type { SupabaseClient } from '@supabase/supabase-js'

type OverlapResult = { hasConflict: boolean; error?: unknown }

interface CheckLessonOverlapArgs {
  supabase: SupabaseClient
  teacherId?: string | null
  studentIds?: (string | null | undefined)[] | string | null
  start: Date
  end: Date
  excludeLessonId?: string
}

/**
 * Checks if a proposed lesson time overlaps any pending/confirmed lesson
 * for the given teacher or student.
 */
export async function checkLessonOverlap({
  supabase,
  teacherId,
  studentIds,
  start,
  end,
  excludeLessonId,
}: CheckLessonOverlapArgs): Promise<OverlapResult> {
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  const studentIdList = Array.isArray(studentIds)
    ? studentIds.filter(Boolean) as string[]
    : studentIds
    ? [studentIds]
    : []

  // 1) Conflicts based on the primary lesson teacher/student
  const participantFilters: string[] = []
  if (teacherId) participantFilters.push(`teacher_id.eq.${teacherId}`)
  if (studentIdList.length > 0) {
    const studentFilters = studentIdList.map((id) => `student_id.eq.${id}`)
    participantFilters.push(...studentFilters)
  }

  let primaryConflict = false
  if (participantFilters.length > 0) {
    const primaryQuery = supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed'])
      .lt('start_time', endIso)
      .gt('end_time', startIso)

    primaryQuery.or(participantFilters.join(','))

    if (excludeLessonId) {
      primaryQuery.neq('id', excludeLessonId)
    }

    const { count, error } = await primaryQuery
    if (error) {
      console.error('checkLessonOverlap failed (primary)', error)
      return { hasConflict: false, error }
    }

    primaryConflict = (count ?? 0) > 0
    if (primaryConflict) return { hasConflict: true }
  }

  return { hasConflict: false }
}


