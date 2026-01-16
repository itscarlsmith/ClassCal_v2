'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Video,
 X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { createMaterialSignedUrl } from '@/lib/storage/materials'
import { getMaterialTypeLabel, normalizeMaterialType } from '@/lib/material-types'
import type { Material } from '@/types/database'

interface LessonMaterialsPanelProps {
  lessonId: string
  onClose?: () => void
}

const externalTypes = new Set(['link', 'video'])

const materialIcons: Record<string, typeof FileText> = {
  document: FileText,
  image: ImageIcon,
  video: Video,
  link: LinkIcon,
  flashcard: BookOpen,
  quiz: BookOpen,
  worksheet: FileSpreadsheet,
}

export function LessonMaterialsPanel({ lessonId, onClose }: LessonMaterialsPanelProps) {
  const supabase = useMemo(() => createClient(), [])
  const user = useAppStore((state) => state.user)
  const [filter, setFilter] = useState<'attached' | 'all'>('attached')

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId, 'teacher-id'],
    queryFn: async () => {
      const { data, error: lessonError } = await supabase
        .from('lessons')
        .select('teacher_id')
        .eq('id', lessonId)
        .single()
      if (lessonError) throw lessonError
      return data as { teacher_id: string }
    },
    enabled: Boolean(lessonId),
  })

  const isTeacher = Boolean(user?.id && lesson?.teacher_id === user?.id)
  const resolvedFilter = isTeacher ? filter : 'attached'

  const {
    data: attachedMaterials,
    isLoading: isLoadingAttached,
    error: attachedError,
  } = useQuery({
    queryKey: ['lesson-materials-panel', lessonId, 'attached'],
    queryFn: async () => {
      const { data: rows, error: lessonMaterialsError } = await supabase
        .from('lesson_materials')
        .select('material_id')
        .eq('lesson_id', lessonId)

      if (lessonMaterialsError) throw lessonMaterialsError

      const materialIds = rows?.map((row) => row.material_id) ?? []
      if (materialIds.length === 0) return []

      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('*')
        .in('id', materialIds)
        .order('title')

      if (materialsError) throw materialsError

      return (materials ?? []) as Material[]
    },
    enabled: Boolean(lessonId),
  })

  const {
    data: allMaterials,
    isLoading: isLoadingAll,
    error: allError,
  } = useQuery({
    queryKey: ['lesson-materials-panel', lessonId, 'all', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('*')
        .eq('teacher_id', user.id)
        .order('title')

      if (materialsError) throw materialsError
      return (materials ?? []) as Material[]
    },
    enabled: Boolean(isTeacher && user?.id),
  })

  const activeMaterials = resolvedFilter === 'all' && isTeacher ? allMaterials : attachedMaterials
  const isLoading = resolvedFilter === 'all' && isTeacher ? isLoadingAll : isLoadingAttached
  const error = resolvedFilter === 'all' && isTeacher ? allError : attachedError

  const tabs = isTeacher ? (
    <Tabs
      value={resolvedFilter}
      onValueChange={(value) => setFilter(value as 'attached' | 'all')}
    >
      <TabsList className="bg-muted/40">
        <TabsTrigger value="attached">Attached</TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>
    </Tabs>
  ) : null

  const header = (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <p className="text-sm font-semibold">Lesson materials</p>
      {onClose && (
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close materials">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  const handleOpen = async (material: Material) => {
    const normalizedType = normalizeMaterialType(material.type)
    if (material.external_url || externalTypes.has(normalizedType)) {
      if (!material.external_url) {
        toast.error('External link is missing for this material.')
        return
      }
      window.open(material.external_url, '_blank', 'noopener,noreferrer')
      return
    }

    if (!material.file_url) {
      toast.error('No file attached to this material.')
      return
    }

    try {
      const signedUrl = await createMaterialSignedUrl({
        supabase,
        path: material.file_url,
        expiresIn: 60 * 10,
      })
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Unable to open this material.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        {header}
        {tabs && <div className="px-4 pt-3">{tabs}</div>}
        <div className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
          Loading materials…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        {header}
        {tabs && <div className="px-4 pt-3">{tabs}</div>}
        <div className="flex flex-1 items-center justify-center px-4 text-sm text-destructive">
          Unable to load materials.
        </div>
      </div>
    )
  }

  if (!activeMaterials || activeMaterials.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {header}
        {tabs && <div className="px-4 pt-3">{tabs}</div>}
        <div className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
          {resolvedFilter === 'all' && isTeacher
            ? 'No materials in your library yet.'
            : 'No materials attached to this lesson.'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {header}
      {tabs && <div className="px-4 pt-3">{tabs}</div>}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <div className="flex flex-col gap-3">
          {activeMaterials.map((material) => {
        const type = normalizeMaterialType(material.type)
        const Icon = materialIcons[type] ?? FileText
        const label = getMaterialTypeLabel(material.type)

        return (
          <div
            key={material.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{material.title}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleOpen(material)}>
              Open
            </Button>
          </div>
        )
          })}
        </div>
      </div>
    </div>
  )
}
