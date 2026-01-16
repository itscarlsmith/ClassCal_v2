import type { SupabaseClient } from '@supabase/supabase-js'

const HOMEWORK_SUBMISSIONS_BUCKET = 'homework-submissions'

interface HomeworkSubmissionPathArgs {
  studentId: string
  homeworkId: string
  submissionId: string
}

export interface UploadHomeworkSubmissionFileArgs extends HomeworkSubmissionPathArgs {
  supabase: SupabaseClient
  file: File
}

export interface CreateSubmissionSignedUrlArgs {
  supabase: SupabaseClient
  path: string
  expiresIn?: number
}

function homeworkSubmissionObjectPath({
  studentId,
  homeworkId,
  submissionId,
}: HomeworkSubmissionPathArgs): string {
  if (!studentId || !homeworkId || !submissionId) {
    throw new Error('Missing identifiers for homework submission path.')
  }
  return `${studentId}/${homeworkId}/${submissionId}`
}

function safeLowerAlnumExt(ext: string | undefined | null) {
  const raw = (ext ?? '').trim().toLowerCase()
  if (!raw) return 'bin'
  const cleaned = raw.replace(/[^a-z0-9]/g, '')
  return cleaned || 'bin'
}

function inferExtension(file: File): string {
  const name = file.name || ''
  const dotIdx = name.lastIndexOf('.')
  if (dotIdx > -1 && dotIdx < name.length - 1) {
    return safeLowerAlnumExt(name.slice(dotIdx + 1))
  }

  const mime = (file.type || '').toLowerCase()
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'text/plain': 'txt',
  }
  return safeLowerAlnumExt(mimeMap[mime] ?? 'bin')
}

export async function uploadHomeworkSubmissionFile({
  supabase,
  studentId,
  homeworkId,
  submissionId,
  file,
}: UploadHomeworkSubmissionFileArgs): Promise<{ path: string; originalFilename: string }> {
  const basePath = homeworkSubmissionObjectPath({ studentId, homeworkId, submissionId })
  const ext = inferExtension(file)
  const objectName = `${crypto.randomUUID()}.${ext}`
  const path = `${basePath}/${objectName}`
  const bucket = supabase.storage.from(HOMEWORK_SUBMISSIONS_BUCKET)
  const { error } = await bucket.upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return { path, originalFilename: file.name || objectName }
}

export async function createHomeworkSubmissionSignedUrl({
  supabase,
  path,
  expiresIn = 60 * 10,
}: CreateSubmissionSignedUrlArgs): Promise<string> {
  if (!path) throw new Error('Missing storage path.')
  if (/^https?:\/\//i.test(path)) return path
  const bucket = supabase.storage.from(HOMEWORK_SUBMISSIONS_BUCKET)
  const { data, error } = await bucket.createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) {
    throw error ?? new Error('Unable to create signed URL for submission.')
  }
  return data.signedUrl
}


