'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Trash2,
  Save,
  FileText,
  Video,
  Link,
  BookOpen,
  HelpCircle,
  FileSpreadsheet,
  X,
  Plus,
  Image as ImageIcon,
} from 'lucide-react'
import type { Material } from '@/types/database'
import {
  createMaterialSignedUrl,
  deleteMaterialFolder,
  isAllowedMaterialFilename,
  uploadMaterialFile,
  type UploadProgressState,
} from '@/lib/storage/materials'
import { getMaterialTypeLabel, normalizeMaterialType } from '@/lib/material-types'

interface MaterialDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

const materialTypes = [
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'link', label: 'External Link', icon: Link },
  { value: 'flashcard', label: 'Flashcards', icon: BookOpen },
  { value: 'quiz', label: 'Quiz', icon: HelpCircle },
  { value: 'worksheet', label: 'Worksheet', icon: FileSpreadsheet },
] as const

const EXTERNAL_TYPES = new Set(['link', 'video'])
const FILE_ACCEPT_STRING =
  '.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp'
const FILE_TYPES_LABEL = FILE_ACCEPT_STRING.replace(/\./g, '').split(',').join(', ')
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])

const isExternalType = (type: string) => EXTERNAL_TYPES.has(type)

const getFileExtensionFromPath = (path?: string | null) => {
  if (!path) return ''
  const cleanPath = path.split('?')[0]
  const lastDotIndex = cleanPath.lastIndexOf('.')
  if (lastDotIndex === -1) return ''
  return cleanPath.slice(lastDotIndex + 1).toLowerCase()
}

const getFilenameFromPath = (path?: string | null) => {
  if (!path) return ''
  const cleanPath = path.split('?')[0]
  const segments = cleanPath.split('/')
  return segments.pop() || ''
}

const isHttpUrl = (path?: string | null) => Boolean(path && /^https?:\/\//i.test(path))

export function MaterialDrawer({ id, data }: MaterialDrawerProps) {
  const { closeDrawer, user } = useAppStore()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const isNew = !id || id === 'new'

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'document',
    file_url: '',
    external_url: '',
    folder: '',
    tags: [] as string[],
  })
  const [newTag, setNewTag] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadProgressState>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Fetch material data
  const { data: material, isLoading } = useQuery({
    queryKey: ['material', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Material
    },
    enabled: !isNew && !!id,
  })

  // Update form when material data loads
  useEffect(() => {
    if (material) {
      setFormData({
        title: material.title,
        description: material.description || '',
        type: normalizeMaterialType(material.type),
        file_url: material.file_url || '',
        external_url: material.external_url || '',
        folder: material.folder || '',
        tags: material.tags || [],
      })
      setSelectedFile(null)
    }
  }, [material])

  useEffect(() => {
    let isCancelled = false

    const loadPreview = async () => {
      if (!formData.file_url || isExternalType(formData.type) || selectedFile) {
        if (!isCancelled) {
          setPreviewUrl(null)
          setPreviewError(null)
          setIsPreviewLoading(false)
        }
        return
      }

      setIsPreviewLoading(true)
      setPreviewError(null)

      const path = formData.file_url

      const checkFileExists = async () => {
        if (isHttpUrl(path)) return true
        const segments = path.split('/')
        const filename = segments.pop()
        if (!filename) return false
        const folderPath = segments.join('/')
        try {
          const { data, error } = await supabase.storage
            .from('materials')
            .list(folderPath, {
              limit: 1,
              search: filename,
            })
          if (error) {
            console.error('Failed to verify material file', error)
            return true
          }
          return data?.some((item) => item.name === filename) ?? false
        } catch (error) {
          console.error('Failed to verify material file', error)
          return true
        }
      }

      const exists = await checkFileExists()
      if (!exists) {
        if (!isCancelled) {
          setPreviewUrl(null)
          setPreviewError('File not found')
          setIsPreviewLoading(false)
        }
        return
      }

      try {
        const signedUrl = await createMaterialSignedUrl({
          supabase,
          path,
          expiresIn: 60 * 10,
        })
        if (!isCancelled) {
          setPreviewUrl(signedUrl)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load material preview', error)
          const message =
            error instanceof Error ? error.message : 'Unable to load preview'
          setPreviewError(message)
          setPreviewUrl(null)
        }
      } finally {
        if (!isCancelled) {
          setIsPreviewLoading(false)
        }
      }
    }

    loadPreview()

    return () => {
      isCancelled = true
    }
  }, [formData.file_url, formData.type, selectedFile, supabase])

  const handleTypeChange = (value: string) => {
    const normalizedValue = normalizeMaterialType(value)
    setFormData((prev) => ({
      ...prev,
      type: normalizedValue,
      external_url: isExternalType(normalizedValue) ? prev.external_url : '',
      file_url: isExternalType(normalizedValue) ? '' : prev.file_url,
    }))

    if (isExternalType(normalizedValue)) {
      setSelectedFile(null)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (file && !isAllowedMaterialFilename(file.name)) {
      setUploadError('Unsupported file type. Please select a permitted format.')
      event.target.value = ''
      setSelectedFile(null)
      return
    }

    setUploadError(null)
    setSelectedFile(file)
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      data,
      file,
    }: {
      data: typeof formData
      file: File | null
    }) => {
      if (!user?.id) {
        throw new Error('Missing teacher context')
      }

      const usesFileUpload = !isExternalType(data.type)
      const payload = {
        title: data.title,
        description: data.description || null,
        type: data.type,
        file_url: usesFileUpload ? data.file_url || null : null,
        external_url: usesFileUpload ? null : data.external_url || null,
        folder: data.folder || null,
        tags: data.tags,
        teacher_id: user.id,
      }

      const bucket = supabase.storage.from('materials')

      if (isNew) {
        let createdMaterialId: string | null = null
        let uploadedPath: string | null = null
        try {
          const { data: newMaterial, error } = await supabase
            .from('materials')
            .insert(payload)
            .select()
            .single()
          if (error) throw error
          createdMaterialId = newMaterial.id

          if (usesFileUpload && file) {
            uploadedPath = await uploadMaterialFile({
              supabase,
              teacherId: user.id,
              materialId: newMaterial.id,
              filename: file.name,
              file,
              onProgress: setUploadState,
            })
            setUploadState('saving')
            const { data: updated, error: updateError } = await supabase
              .from('materials')
              .update({ file_url: uploadedPath })
              .eq('id', newMaterial.id)
              .select()
              .single()
            if (updateError) throw updateError
            return updated
          }

          return newMaterial
        } catch (error) {
          if (uploadedPath) {
            bucket.remove([uploadedPath]).catch((cleanupError) =>
              console.error('Failed to remove uploaded file', cleanupError)
            )
          }
          if (createdMaterialId) {
            await supabase.from('materials').delete().eq('id', createdMaterialId)
            await deleteMaterialFolder({
              supabase,
              teacherId: user.id,
              materialId: createdMaterialId,
            }).catch((cleanupError) =>
              console.error('Failed to clean material folder', cleanupError)
            )
          }
          throw error
        }
      } else {
        const materialId = id as string
        let filePath = payload.file_url
        if (usesFileUpload && file) {
          filePath = await uploadMaterialFile({
            supabase,
            teacherId: user.id,
            materialId,
            filename: file.name,
            file,
            onProgress: setUploadState,
          })
        }
        setUploadState('saving')
        const { data: updated, error } = await supabase
          .from('materials')
          .update({
            ...payload,
            file_url: usesFileUpload ? filePath : null,
          })
          .eq('id', materialId)
          .select()
          .single()
        if (error) {
          if (usesFileUpload && filePath && file && filePath !== payload.file_url) {
            bucket.remove([filePath]).catch((cleanupError) =>
              console.error('Failed to rollback uploaded file', cleanupError)
            )
          }
          throw error
        }
        return updated
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      queryClient.invalidateQueries({ queryKey: ['material', id] })
      toast.success(isNew ? 'Material created' : 'Material updated')
      setSelectedFile(null)
      setUploadError(null)
      if (isNew) closeDrawer()
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to save material'
      setUploadError(message)
      toast.error(message)
      console.error(error)
    },
    onSettled: () => {
      setUploadState('idle')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !id) {
        throw new Error('Missing context for deletion')
      }
      const materialId = id as string
      const { error } = await supabase.from('materials').delete().eq('id', materialId)
      if (error) throw error
      try {
        await deleteMaterialFolder({
          supabase,
          teacherId: user.id,
          materialId,
        })
      } catch (folderError) {
        console.error('Failed to delete material files', folderError)
        throw new Error('Material removed, but file cleanup failed. Please try again.')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      toast.success('Material deleted')
      closeDrawer()
    },
    onError: (error) => {
      toast.error('Failed to delete material')
      console.error(error)
    },
  })

  const handleSave = () => {
    if (!formData.title || !formData.type) {
      toast.error('Please fill in all required fields')
      return
    }

    const usesFileUpload = !isExternalType(formData.type)

    if (usesFileUpload && isNew && !selectedFile) {
      toast.error('Please select a file to upload')
      return
    }

    if (usesFileUpload && !isNew && !selectedFile && !formData.file_url) {
      toast.error('Please add a file for this material')
      return
    }

    if (!usesFileUpload && !formData.external_url) {
      toast.error('Please provide a URL')
      return
    }

    setUploadError(null)
    setUploadState('creating')
    saveMutation.mutate({ data: formData, file: selectedFile })
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tagToRemove) })
  }

  const TypeIcon = materialTypes.find((t) => t.value === formData.type)?.icon || FileText
  const fileExtension = getFileExtensionFromPath(formData.file_url)
  const isPdfPreview = fileExtension === 'pdf'
  const isImagePreview = IMAGE_EXTENSIONS.has(fileExtension)
  const filename = getFilenameFromPath(formData.file_url)

  const openPreviewInNewTab = () => {
    if (!previewUrl) {
      toast.error('Preview not available yet.')
      return
    }
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  const openExternalResource = () => {
    if (!formData.external_url) {
      toast.error('Please add a URL to preview this material.')
      return
    }
    window.open(formData.external_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Drawer
      title={isNew ? 'Add Material' : material?.title || 'Material'}
      subtitle={isNew ? 'Add a new teaching resource' : getMaterialTypeLabel(material?.type)}
      width="md"
      footer={
        <DrawerFooter>
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (confirm('Are you sure you want to delete this material?')) {
                  deleteMutation.mutate()
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={closeDrawer}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {isNew ? 'Add Material' : 'Save Changes'}
          </Button>
        </DrawerFooter>
      }
    >
      {isLoading && !isNew ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Type Preview */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TypeIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{formData.title || 'Untitled Material'}</h3>
              <p className="text-sm text-muted-foreground">
                {getMaterialTypeLabel(formData.type)}
              </p>
            </div>
          </div>

          <DrawerSection title="Preview">
            {isExternalType(formData.type) ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Open the {formData.type === 'video' ? 'video' : 'link'} in a new tab to preview it.
                </p>
                <Button variant="outline" onClick={openExternalResource} disabled={!formData.external_url}>
                  Open {formData.type === 'video' ? 'Video' : 'Link'}
                </Button>
                {!formData.external_url && (
                  <p className="text-xs text-muted-foreground">Add a URL above to enable preview.</p>
                )}
              </div>
            ) : selectedFile ? (
              <p className="text-sm text-muted-foreground">
                Save changes to preview the newly selected file.
              </p>
            ) : formData.file_url ? (
              <div className="space-y-3">
                {isPreviewLoading && (
                  <p className="text-sm text-muted-foreground">Loading preview…</p>
                )}
                {previewError && <p className="text-sm text-destructive">{previewError}</p>}
                {!isPreviewLoading && !previewError && previewUrl && (
                  <>
                    {isPdfPreview ? (
                      <div className="space-y-2">
                        <iframe
                          src={previewUrl}
                          title="PDF preview"
                          className="w-full h-64 rounded-lg border"
                        />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate">{filename || 'File'}</span>
                          <Button variant="outline" size="sm" onClick={openPreviewInNewTab}>
                            Open
                          </Button>
                        </div>
                      </div>
                    ) : isImagePreview ? (
                      <div className="space-y-2">
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={previewUrl}
                            alt={filename || 'Material preview'}
                            className="max-h-64 w-full object-contain rounded-lg border bg-background"
                          />
                        </a>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate">{filename || 'File'}</span>
                          <Button variant="outline" size="sm" onClick={openPreviewInNewTab}>
                            Open
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="mr-4 min-w-0">
                          <p className="font-medium text-sm truncate">{filename || 'File'}</p>
                          <p className="text-xs text-muted-foreground">
                            Preview unavailable. Open to download this file.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={openPreviewInNewTab}>
                          Open
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isNew ? 'Upload a file to enable preview.' : 'No file available to preview.'}
              </p>
            )}
          </DrawerSection>

          <DrawerSection title="Material Details">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Grammar Basics Worksheet"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {materialTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this material..."
                  rows={3}
                />
              </div>

              {formData.type === 'link' || formData.type === 'video' ? (
                <div className="grid gap-2">
                  <Label htmlFor="external_url">URL</Label>
                  <Input
                    key="external_url_input"
                    id="external_url"
                    value={formData.external_url}
                    onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="material_file">File *</Label>
                  <Input
                    key="material_file_input"
                    id="material_file"
                    type="file"
                    accept={FILE_ACCEPT_STRING}
                    onChange={handleFileChange}
                  />
                  {selectedFile ? (
                    <p className="text-xs text-muted-foreground">
                      Selected: <span className="font-medium">{selectedFile.name}</span>
                    </p>
                  ) : formData.file_url ? (
                    <p className="text-xs text-muted-foreground">
                      Current file: <span className="font-medium">{formData.file_url.split('/').pop()}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No file selected yet.</p>
                  )}
                  <p className="text-xs text-muted-foreground">Allowed types: {FILE_TYPES_LABEL}</p>
                  {uploadState !== 'idle' && (
                    <p className="text-xs text-muted-foreground">
                      {uploadState === 'creating' && 'Creating material…'}
                      {uploadState === 'validating' && 'Validating file…'}
                      {uploadState === 'uploading' && 'Uploading file…'}
                      {uploadState === 'saving' && 'Saving material…'}
                    </p>
                  )}
                  {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="folder">Folder</Label>
                <Input
                  id="folder"
                  value={formData.folder}
                  onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                  placeholder="e.g., Grammar, Vocabulary"
                />
              </div>

              <div className="grid gap-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  )
}

