'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Search,
  FolderOpen,
  FileText,
  Video,
  Link,
  BookOpen,
  HelpCircle,
  FileSpreadsheet,
  Grid,
  List,
  Image as ImageIcon,
} from 'lucide-react'
import type { Material } from '@/types/database'
import { getMaterialTypeLabel, normalizeMaterialType } from '@/lib/material-types'

const typeIcons: Record<string, React.ElementType> = {
  document: FileText,
  image: ImageIcon,
  video: Video,
  link: Link,
  flashcard: BookOpen,
  quiz: HelpCircle,
  worksheet: FileSpreadsheet,
}

const typeColors: Record<string, string> = {
  document: 'bg-red-100 text-red-600',
  image: 'bg-emerald-100 text-emerald-600',
  video: 'bg-purple-100 text-purple-600',
  link: 'bg-blue-100 text-blue-600',
  flashcard: 'bg-green-100 text-green-600',
  quiz: 'bg-amber-100 text-amber-600',
  worksheet: 'bg-teal-100 text-teal-600',
}

const getTypeMeta = (type?: string | null) => {
  const normalized = normalizeMaterialType(type)
  const Icon = typeIcons[normalized] || FileText
  const colorClass = typeColors[normalized] || 'bg-gray-100 text-gray-600'
  const label = getMaterialTypeLabel(normalized)
  return { normalized, Icon, colorClass, label }
}

export default function LibraryPage() {
  const { openDrawer } = useAppStore()
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Fetch materials
  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('teacher_id', userData.user?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Material[]
    },
  })

  const filteredMaterials = materials?.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Group by type
  const flashcards = filteredMaterials?.filter((m) => m.type === 'flashcard')
  const quizzes = filteredMaterials?.filter((m) => m.type === 'quiz')
  const worksheets = filteredMaterials?.filter((m) => m.type === 'worksheet')
  const uploads = filteredMaterials?.filter((m) => Boolean(m.file_url))

  const MaterialCard = ({ material }: { material: Material }) => {
    const { Icon, colorClass } = getTypeMeta(material.type)
    
    return (
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => openDrawer('material', material.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{material.title}</h3>
              {material.description && (
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {material.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {material.tags?.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const MaterialListItem = ({ material }: { material: Material }) => {
    const { Icon, colorClass, label } = getTypeMeta(material.type)
    
    return (
      <div
        className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
        onClick={() => openDrawer('material', material.id)}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{material.title}</h3>
          {material.description && (
            <p className="text-sm text-muted-foreground truncate">
              {material.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {material.tags?.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <Badge variant="outline" className="capitalize">
          {label}
        </Badge>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => openDrawer('material', 'new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({filteredMaterials?.length || 0})</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards ({flashcards?.length || 0})</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes ({quizzes?.length || 0})</TabsTrigger>
          <TabsTrigger value="worksheets">Worksheets ({worksheets?.length || 0})</TabsTrigger>
          <TabsTrigger value="uploads">Uploads ({uploads?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredMaterials && filteredMaterials.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMaterials.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMaterials.map((material) => (
                  <MaterialListItem key={material.id} material={material} />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No materials found' : 'No materials yet'}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => openDrawer('material', 'new')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Material
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flashcards" className="mt-6">
          {flashcards && flashcards.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {flashcards.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {flashcards.map((material) => (
                  <MaterialListItem key={material.id} material={material} />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No flashcards yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="mt-6">
          {quizzes && quizzes.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {quizzes.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {quizzes.map((material) => (
                  <MaterialListItem key={material.id} material={material} />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No quizzes yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="worksheets" className="mt-6">
          {worksheets && worksheets.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {worksheets.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {worksheets.map((material) => (
                  <MaterialListItem key={material.id} material={material} />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No worksheets yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="uploads" className="mt-6">
          {uploads && uploads.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {uploads.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {uploads.map((material) => (
                  <MaterialListItem key={material.id} material={material} />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No uploads yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

