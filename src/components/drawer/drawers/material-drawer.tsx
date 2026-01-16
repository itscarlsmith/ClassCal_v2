'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import type { Material } from '@/types/database'

interface MaterialDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

const materialTypes = [
  { value: 'pdf', label: 'PDF Document', icon: FileText },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'link', label: 'External Link', icon: Link },
  { value: 'flashcard', label: 'Flashcards', icon: BookOpen },
  { value: 'quiz', label: 'Quiz', icon: HelpCircle },
  { value: 'worksheet', label: 'Worksheet', icon: FileSpreadsheet },
]

export function MaterialDrawer({ id, data }: MaterialDrawerProps) {
  const { closeDrawer, user } = useAppStore()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const isNew = !id || id === 'new'

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'pdf',
    file_url: '',
    external_url: '',
    folder: '',
    tags: [] as string[],
  })
  const [newTag, setNewTag] = useState('')

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
        type: material.type,
        file_url: material.file_url || '',
        external_url: material.external_url || '',
        folder: material.folder || '',
        tags: material.tags || [],
      })
    }
  }, [material])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        teacher_id: user?.id,
      }

      if (isNew) {
        const { data: newMaterial, error } = await supabase
          .from('materials')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return newMaterial
      } else {
        const { data: updated, error } = await supabase
          .from('materials')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      queryClient.invalidateQueries({ queryKey: ['material', id] })
      toast.success(isNew ? 'Material created' : 'Material updated')
      if (isNew) closeDrawer()
    },
    onError: (error) => {
      toast.error('Failed to save material')
      console.error(error)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('materials').delete().eq('id', id)
      if (error) throw error
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
    saveMutation.mutate(formData)
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

  return (
    <Drawer
      title={isNew ? 'Add Material' : material?.title || 'Material'}
      subtitle={isNew ? 'Add a new teaching resource' : material?.type}
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
                {materialTypes.find((t) => t.value === formData.type)?.label}
              </p>
            </div>
          </div>

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
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
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
                    id="external_url"
                    value={formData.external_url}
                    onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="file_url">File URL</Label>
                  <Input
                    id="file_url"
                    value={formData.file_url}
                    onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                    placeholder="Upload or paste file URL"
                  />
                  <p className="text-xs text-muted-foreground">
                    File upload coming soon. For now, paste the file URL.
                  </p>
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

