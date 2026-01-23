'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Trash2, Save, Package } from 'lucide-react'
import type { Package as PackageType } from '@/types/database'
import { formatCurrency } from '@/lib/currency'

interface PackageDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

export function PackageDrawer({ id, data }: PackageDrawerProps) {
  const { closeDrawer, user } = useAppStore()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const isNew = !id || id === 'new'

  void data

  const initialFormDataRef = useRef({
    name: '',
    description: '',
    credits: 1,
    price: 0,
    is_active: true,
  })

  const [formData, setFormData] = useState(initialFormDataRef.current)
  const hydratedIdRef = useRef<string | null>(null)

  // Fetch package data
  const { data: pkg, isLoading } = useQuery({
    queryKey: ['package', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as PackageType
    },
    enabled: !isNew && !!id,
  })

  const { data: teacherSettings } = useQuery({
    queryKey: ['teacher-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('teacher_settings')
        .select('currency_code')
        .eq('teacher_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (isNew) {
      if (hydratedIdRef.current !== 'new') {
        setFormData(initialFormDataRef.current)
        hydratedIdRef.current = 'new'
      }
      return
    }

    if (!id || !pkg || hydratedIdRef.current === id) return

    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      credits: pkg.credits,
      price: pkg.price,
      is_active: pkg.is_active,
    })
    hydratedIdRef.current = id
  }, [id, isNew, pkg])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        teacher_id: user?.id,
      }

      if (isNew) {
        const { data: newPackage, error } = await supabase
          .from('packages')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return newPackage
      } else {
        const { data: updated, error } = await supabase
          .from('packages')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      queryClient.invalidateQueries({ queryKey: ['package', id] })
      toast.success(isNew ? 'Package created' : 'Package updated')
      if (isNew) closeDrawer()
    },
    onError: () => {
      toast.error('Failed to save package')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('packages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      toast.success('Package deleted')
      closeDrawer()
    },
    onError: () => {
      toast.error('Failed to delete package')
    },
  })

  const handleSave = () => {
    if (!formData.name || formData.credits < 1 || formData.price <= 0) {
      toast.error('Please fill in all required fields')
      return
    }
    saveMutation.mutate(formData)
  }

  const currencyCode = teacherSettings?.currency_code ?? 'USD'
  const pricePerCredit = formData.credits > 0 ? formData.price / formData.credits : 0

  return (
    <Drawer
      title={isNew ? 'Create Package' : pkg?.name || 'Package'}
      subtitle={
        isNew
          ? 'Set up a new lesson package'
          : `${pkg?.credits} credits for ${formatCurrency(pkg?.price ?? 0, currencyCode)}`
      }
      width="md"
      footer={
        <DrawerFooter>
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (confirm('Are you sure you want to delete this package?')) {
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
            {isNew ? 'Create Package' : 'Save Changes'}
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
          {/* Preview Card */}
          <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{formData.name || 'Package Name'}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(pricePerCredit, currencyCode)} per credit
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">
                {formatCurrency(formData.price, currencyCode)}
              </span>
              <span className="text-muted-foreground">for {formData.credits} credits</span>
            </div>
          </div>

          <DrawerSection title="Package Details">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 10 Lesson Pack"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what's included..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="credits">Credits *</Label>
                  <Input
                    id="credits"
                    type="number"
                    min="1"
                    value={formData.credits}
                    onChange={(e) =>
                      setFormData({ ...formData, credits: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label htmlFor="is_active" className="text-base">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Students can see and purchase this package
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  )
}

