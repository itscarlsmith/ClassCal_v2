'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

type NotificationRole = 'teacher' | 'student'

type NotificationTypeCatalog = {
  notification_type: string
  label: string
  category: 'lessons' | 'homework' | 'messages' | 'credits'
  allowed_roles: NotificationRole[]
  supports_timing: boolean
  supports_thresholds: boolean
  default_in_app_enabled: boolean
  default_email_enabled: boolean
  default_timing_minutes: number[] | null
  default_credit_thresholds: number[] | null
}

type NotificationPreference = {
  id: string
  user_id: string
  notification_type: string
  in_app_enabled: boolean
  email_enabled: boolean
  timing_minutes: number[] | null
  credit_thresholds: number[] | null
}

const categoryLabels: Record<NotificationTypeCatalog['category'], string> = {
  lessons: 'Lessons',
  homework: 'Homework',
  messages: 'Messages',
  credits: 'Credits',
}

const categoryOrder: NotificationTypeCatalog['category'][] = [
  'lessons',
  'homework',
  'messages',
  'credits',
]

function formatMinutes(value: number) {
  if (value === 60) return '1 hour before'
  if (value % 60 === 0) {
    const hours = value / 60
    return `${hours} hours before`
  }
  return `${value} minutes before`
}

function normalizeTiming(values: number[] | null) {
  if (!values) return []
  const unique = Array.from(new Set(values.filter((v) => Number.isFinite(v) && v > 0)))
  return unique.sort((a, b) => a - b)
}

function normalizeThresholds(values: number[] | null) {
  if (!values) return []
  const unique = Array.from(new Set(values.filter((v) => Number.isFinite(v) && v > 0)))
  return unique.sort((a, b) => b - a)
}

export function NotificationSettingsPanel() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const user = useAppStore((state) => state.user)
  const role: NotificationRole = user?.role === 'teacher' ? 'teacher' : 'student'
  const userId = user?.id ?? null
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({})

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['notification-type-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_type_catalog')
        .select('*')
      if (error) throw error
      return (data || []) as NotificationTypeCatalog[]
    },
  })

  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ['notification-preferences', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [] as NotificationPreference[]
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
      if (error) throw error
      return (data || []) as NotificationPreference[]
    },
  })

  const preferencesByType = useMemo(() => {
    const map = new Map<string, NotificationPreference>()
    preferences?.forEach((pref) => map.set(pref.notification_type, pref))
    return map
  }, [preferences])

  const updatePreference = useMutation({
    mutationFn: async ({
      notificationType,
      next,
    }: {
      notificationType: string
      next: Partial<NotificationPreference>
    }) => {
      if (!userId) throw new Error('Missing user')
      const payload = {
        user_id: userId,
        notification_type: notificationType,
        ...next,
      }
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(payload, { onConflict: 'user_id,notification_type' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update preferences'
      toast.error(message)
    },
  })

  const grouped = useMemo(() => {
    const list = (catalog || [])
      .filter((row) => row.allowed_roles?.includes(role))
      .sort((a, b) => a.label.localeCompare(b.label))
    return categoryOrder.map((category) => ({
      category,
      items: list.filter((row) => row.category === category),
    }))
  }, [catalog, role])

  const getEffective = (row: NotificationTypeCatalog) => {
    const pref = preferencesByType.get(row.notification_type)
    return {
      in_app_enabled: pref?.in_app_enabled ?? row.default_in_app_enabled,
      email_enabled: pref?.email_enabled ?? row.default_email_enabled,
      timing_minutes:
        pref?.timing_minutes ?? row.default_timing_minutes ?? [],
      credit_thresholds:
        pref?.credit_thresholds ?? row.default_credit_thresholds ?? [],
    }
  }

  const savePreference = (
    row: NotificationTypeCatalog,
    overrides: Partial<ReturnType<typeof getEffective>>
  ) => {
    if (!userId) return
    const current = getEffective(row)
    const timing = row.supports_timing
      ? normalizeTiming(
          overrides.timing_minutes ?? current.timing_minutes
        )
      : null
    const thresholds = row.supports_thresholds
      ? normalizeThresholds(
          overrides.credit_thresholds ?? current.credit_thresholds
        )
      : null

    updatePreference.mutate({
      notificationType: row.notification_type,
      next: {
        in_app_enabled:
          overrides.in_app_enabled ?? current.in_app_enabled,
        email_enabled:
          overrides.email_enabled ?? current.email_enabled,
        timing_minutes: timing,
        credit_thresholds: thresholds,
      },
    })
  }

  if (catalogLoading || prefsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading notification preferences…</p>
        </CardContent>
      </Card>
    )
  }

  if (!catalog || catalog.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notification settings are unavailable right now.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ category, items }) =>
        items.length === 0 ? null : (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{categoryLabels[category]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((row, index) => {
                const effective = getEffective(row)
                const timingOptions = normalizeTiming(
                  row.default_timing_minutes ?? []
                )
                const thresholds = normalizeThresholds(effective.credit_thresholds)
                const thresholdInput = thresholdInputs[row.notification_type] ?? ''

                return (
                  <div key={row.notification_type}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{row.label}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">In-app</span>
                          <Switch
                            checked={effective.in_app_enabled}
                            onCheckedChange={(checked) =>
                              savePreference(row, { in_app_enabled: checked })
                            }
                            disabled={!userId || updatePreference.isPending}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Email</span>
                          <Switch
                            checked={effective.email_enabled}
                            onCheckedChange={(checked) =>
                              savePreference(row, { email_enabled: checked })
                            }
                            disabled={!userId || updatePreference.isPending}
                          />
                        </div>
                      </div>
                    </div>

                    {row.supports_timing && timingOptions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {timingOptions.map((minutes) => {
                          const isChecked = normalizeTiming(
                            effective.timing_minutes
                          ).includes(minutes)
                          return (
                            <label
                              key={minutes}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const next = new Set(
                                    normalizeTiming(effective.timing_minutes)
                                  )
                                  if (checked) {
                                    next.add(minutes)
                                  } else {
                                    next.delete(minutes)
                                  }
                                  savePreference(row, {
                                    timing_minutes: Array.from(next),
                                  })
                                }}
                                disabled={!userId || updatePreference.isPending}
                              />
                              {formatMinutes(minutes)}
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {row.supports_thresholds && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {thresholds.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              No thresholds configured.
                            </span>
                          )}
                          {thresholds.map((value) => (
                            <div
                              key={value}
                              className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
                            >
                              {value} credits
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() =>
                                  savePreference(row, {
                                    credit_thresholds: thresholds.filter(
                                      (threshold) => threshold !== value
                                    ),
                                  })
                                }
                                disabled={!userId || updatePreference.isPending}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 max-w-xs">
                          <Input
                            placeholder="Add threshold"
                            value={thresholdInput}
                            onChange={(event) =>
                              setThresholdInputs((prev) => ({
                                ...prev,
                                [row.notification_type]: event.target.value,
                              }))
                            }
                            disabled={!userId || updatePreference.isPending}
                          />
                          <Button
                            variant="outline"
                            onClick={() => {
                              const value = Number(thresholdInput)
                              if (!Number.isFinite(value) || value <= 0) {
                                toast.error('Enter a positive number')
                                return
                              }
                              const next = normalizeThresholds([
                                ...thresholds,
                                value,
                              ])
                              savePreference(row, { credit_thresholds: next })
                              setThresholdInputs((prev) => ({
                                ...prev,
                                [row.notification_type]: '',
                              }))
                            }}
                            disabled={!userId || updatePreference.isPending}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    )}

                    {index < items.length - 1 && <Separator className="mt-4" />}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      )}
    </div>
  )
}
