import type { SupabaseClient } from '@supabase/supabase-js'

const MATERIALS_BUCKET = 'materials'

export const ALLOWED_MATERIAL_EXTENSIONS = [
  'pdf',
  'txt',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'webp',
] as const

type AllowedExtension = (typeof ALLOWED_MATERIAL_EXTENSIONS)[number]

export type UploadProgressState = 'idle' | 'creating' | 'validating' | 'uploading' | 'saving'

export interface MaterialObjectPathArgs {
  teacherId: string
  materialId: string
  filename: string
}

export interface UploadMaterialFileArgs extends MaterialObjectPathArgs {
  supabase: SupabaseClient
  file: File
  onProgress?: (phase: UploadProgressState) => void
}

export interface CreateSignedUrlArgs {
  supabase: SupabaseClient
  path: string
  expiresIn?: number
}

export interface DeleteMaterialFolderArgs {
  supabase: SupabaseClient
  teacherId: string
  materialId: string
}

export function isAllowedMaterialFilename(filename: string): boolean {
  const ext = getExtension(filename)
  return Boolean(ext && ALLOWED_MATERIAL_EXTENSIONS.includes(ext as AllowedExtension))
}

export function materialObjectPath({ teacherId, materialId, filename }: MaterialObjectPathArgs): string {
  if (!teacherId || !materialId) {
    throw new Error('Missing teacher or material identifier for storage path.')
  }
  const sanitizedFilename = filename.trim()
  if (!sanitizedFilename) {
    throw new Error('Filename cannot be empty.')
  }
  return `${teacherId}/${materialId}/${sanitizedFilename}`
}

export async function uploadMaterialFile({
  supabase,
  teacherId,
  materialId,
  file,
  onProgress,
}: UploadMaterialFileArgs): Promise<string> {
  onProgress?.('validating')
  if (!isAllowedMaterialFilename(file.name)) {
    throw new Error('Unsupported file type. Please upload an allowed file format.')
  }

  const path = materialObjectPath({ teacherId, materialId, filename: file.name })
  const bucket = supabase.storage.from(MATERIALS_BUCKET)

  onProgress?.('uploading')
  const { error } = await bucket.upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })

  if (error) {
    throw error
  }

  return path
}

export async function createMaterialSignedUrl({
  supabase,
  path,
  expiresIn = 60 * 60, // 1 hour
}: CreateSignedUrlArgs): Promise<string> {
  if (!path) {
    throw new Error('Missing storage path for material.')
  }

  // Allow legacy absolute URLs to continue working without signing.
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const bucket = supabase.storage.from(MATERIALS_BUCKET)
  const { data, error } = await bucket.createSignedUrl(path, expiresIn)

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Unable to create signed URL')
  }

  return data.signedUrl
}

export async function deleteMaterialFolder({
  supabase,
  teacherId,
  materialId,
}: DeleteMaterialFolderArgs): Promise<void> {
  const prefix = `${teacherId}/${materialId}`
  const bucket = supabase.storage.from(MATERIALS_BUCKET)
  const pageSize = 100
  let offset = 0

  while (true) {
    const { data, error } = await bucket.list(prefix, {
      limit: pageSize,
      offset,
    })

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    const pathsToRemove = data
      .filter((item) => item.name)
      .map((item) => `${prefix}/${item.name}`)

    if (pathsToRemove.length > 0) {
      const { error: removeError } = await bucket.remove(pathsToRemove)
      if (removeError) {
        throw removeError
      }
    }

    if (data.length < pageSize) {
      break
    }

    offset += pageSize
  }
}

function getExtension(filename: string): string | null {
  const parts = filename.toLowerCase().split('.')
  if (parts.length <= 1) {
    return null
  }
  return parts.pop() || null
}
