'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Save, User, Calendar, Receipt, LogOut } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Profile, TeacherSettings } from '@/types/database'
import { normalizeCurrencyCode } from '@/lib/currency'

type SettingsTab = 'profile' | 'scheduling' | 'billing' | 'notifications' | 'calendar-sync'

const supportedTabs: SettingsTab[] = [
  'profile',
  'scheduling',
  'billing',
  'notifications',
  'calendar-sync',
]

function normalizeTab(value: string | null): SettingsTab {
  if (!value) return 'profile'
  const match = supportedTabs.find((tab) => tab === value)
  return match ?? 'profile'
}

export default function SettingsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromQuery = normalizeTab(searchParams.get('tab'))
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromQuery)

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user?.id)
        .single()
      if (error) throw error
      return data as Profile
    },
  })

  // Fetch teacher settings
  const { data: teacherSettings } = useQuery({
    queryKey: ['teacher-settings'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('teacher_settings')
        .select('*')
        .eq('teacher_id', userData.user?.id)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data as TeacherSettings | null
    },
  })

  const profileFormRef = useRef({
    full_name: '',
    email: '',
    timezone: 'America/New_York',
  })
  const [profileForm, setProfileForm] = useState(profileFormRef.current)
  const profileHydratedRef = useRef<string | null>(null)

  const settingsFormRef = useRef({
    cancellation_policy_hours: 24,
    default_lesson_duration: 60,
    booking_buffer_hours: 2,
    max_advance_booking_days: 30,
    default_hourly_rate: 45,
    currency_code: 'USD',
    country: '',
  })
  const [settingsForm, setSettingsForm] = useState(settingsFormRef.current)
  const settingsHydratedRef = useRef<string | null>(null)
  const [currencySelectorValue, setCurrencySelectorValue] = useState('USD')

  useEffect(() => {
    setActiveTab(tabFromQuery)
  }, [tabFromQuery])

  useEffect(() => {
    if (!profile) return
    if (profileHydratedRef.current === profile.id) return
    setProfileForm({
      full_name: profile.full_name,
      email: profile.email,
      timezone: profile.timezone,
    })
    profileHydratedRef.current = profile.id
  }, [profile])

  useEffect(() => {
    if (!profile) return
    if (settingsHydratedRef.current === profile.id) return
    if (teacherSettings === undefined) return
    if (teacherSettings === null) {
      settingsHydratedRef.current = profile.id
      return
    }
    setSettingsForm({
      cancellation_policy_hours: teacherSettings.cancellation_policy_hours,
      default_lesson_duration: teacherSettings.default_lesson_duration,
      booking_buffer_hours: teacherSettings.booking_buffer_hours,
      max_advance_booking_days: teacherSettings.max_advance_booking_days,
      default_hourly_rate: teacherSettings.default_hourly_rate,
      currency_code: teacherSettings.currency_code,
      country: teacherSettings.country ?? '',
    })
    const normalizedCurrency = normalizeCurrencyCode(teacherSettings.currency_code)
    setCurrencySelectorValue(
      ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CZK'].includes(normalizedCurrency)
        ? normalizedCurrency
        : 'OTHER'
    )
    settingsHydratedRef.current = profile.id
  }, [profile, teacherSettings])

  // Save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userData.user?.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Profile updated')
    },
    onError: () => {
      toast.error('Failed to update profile')
    },
  })

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: typeof settingsForm) => {
      const { data: userData } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('teacher_settings')
        .upsert({
          teacher_id: userData.user?.id,
          ...data,
        }, { onConflict: 'teacher_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-settings'] })
      toast.success('Settings updated')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update settings'
      toast.error(message)
    },
  })

  const connectStripeMutation = useMutation({
    mutationFn: async () => {
      const normalizedCountry = settingsForm.country.trim().toUpperCase()
      const normalizedCurrency = normalizeCurrencyCode(settingsForm.currency_code)

      if (!normalizedCountry || normalizedCountry.length !== 2) {
        throw new Error('Please enter a valid 2-letter country code')
      }
      if (!normalizedCurrency) {
        throw new Error('Please select a currency before connecting Stripe')
      }

      await saveSettingsMutation.mutateAsync({
        ...settingsForm,
        country: normalizedCountry,
        currency_code: normalizedCurrency,
      })

      const response = await fetch('/api/stripe/connect', { method: 'POST' })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error || 'Failed to start Stripe onboarding')
      }

      const payload = (await response.json()) as { url?: string }
      if (!payload.url) {
        throw new Error('Stripe onboarding URL is missing')
      }

      window.location.assign(payload.url)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Stripe setup failed'
      toast.error(message)
    },
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ]

  const currencyOptions = [
    { value: 'USD', label: 'USD – US Dollar' },
    { value: 'EUR', label: 'EUR – Euro' },
    { value: 'GBP', label: 'GBP – British Pound' },
    { value: 'CAD', label: 'CAD – Canadian Dollar' },
    { value: 'AUD', label: 'AUD – Australian Dollar' },
    { value: 'CZK', label: 'CZK – Czech Koruna' },
  ]

  const stripeHasAccount = Boolean(teacherSettings?.stripe_account_id)
  const stripeIsReady = Boolean(
    teacherSettings?.stripe_charges_enabled && teacherSettings?.stripe_payouts_enabled
  )
  const stripeStatusLabel = !stripeHasAccount
    ? 'Stripe not connected'
    : stripeIsReady
    ? 'Stripe connected'
    : 'Stripe incomplete'

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="scheduling">
            <Calendar className="w-4 h-4 mr-2" />
            Scheduling
          </TabsTrigger>
          <TabsTrigger value="billing">
            <Receipt className="w-4 h-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications
          </TabsTrigger>
          <TabsTrigger value="calendar-sync">
            Calendar sync
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    Change Avatar
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    JPG, PNG or GIF. Max 2MB.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Form */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, full_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={profileForm.timezone}
                    onValueChange={(value) =>
                      setProfileForm({ ...profileForm, timezone: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveProfileMutation.mutate(profileForm)}
                  disabled={saveProfileMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logout */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Sign Out</CardTitle>
              <CardDescription>
                Sign out of your ClassCal account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduling Tab */}
        <TabsContent value="scheduling" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scheduling Rules</CardTitle>
              <CardDescription>
                Configure how students can book lessons with you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="default_duration">Default Lesson Duration (minutes)</Label>
                  <Select
                    value={String(settingsForm.default_lesson_duration ?? 60)}
                    onValueChange={(value) =>
                      setSettingsForm({
                        ...settingsForm,
                        default_lesson_duration: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                      <SelectItem value="120">120 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="buffer">Booking Buffer (hours)</Label>
                  <Input
                    id="buffer"
                    type="number"
                    min="0"
                    value={settingsForm.booking_buffer_hours}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        booking_buffer_hours: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum hours before a lesson that students can book
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="advance">Maximum Advance Booking (days)</Label>
                  <Input
                    id="advance"
                    type="number"
                    min="1"
                    value={settingsForm.max_advance_booking_days}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        max_advance_booking_days: parseInt(e.target.value) || 30,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    How far in advance students can book lessons
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cancellation">Cancellation Policy (hours)</Label>
                  <Input
                    id="cancellation"
                    type="number"
                    min="0"
                    value={settingsForm.cancellation_policy_hours}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        cancellation_policy_hours: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Students who cancel within this window will lose their credit
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveSettingsMutation.mutate(settingsForm)}
                  disabled={saveSettingsMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                Connect a Stripe Express account to receive student payments directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Stripe status</p>
                    <Badge variant={stripeIsReady ? 'default' : 'secondary'}>
                      {stripeStatusLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Stripe onboarding is required before students can purchase credits.
                  </p>
                </div>
                {!stripeIsReady && (
                  <Button
                    onClick={() => connectStripeMutation.mutate()}
                    disabled={connectStripeMutation.isPending || saveSettingsMutation.isPending}
                  >
                    {stripeHasAccount ? 'Continue Stripe setup' : 'Connect Stripe'}
                  </Button>
                )}
              </div>
              <div className="grid gap-2 max-w-sm">
                <Label htmlFor="stripe_country">Country (ISO code)</Label>
                <Input
                  id="stripe_country"
                  value={settingsForm.country}
                  maxLength={2}
                  placeholder="US"
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      country: e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase(),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Two-letter ISO country code required for Stripe Express.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>
                Set your default hourly rate for students who do not have an override.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid gap-2 lg:flex-1">
                  <Label htmlFor="currency_code">Currency</Label>
                  <Select
                    value={currencySelectorValue}
                    onValueChange={(value) => {
                      setCurrencySelectorValue(value)
                      if (value !== 'OTHER') {
                        setSettingsForm({
                          ...settingsForm,
                          currency_code: value,
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="w-full lg:max-w-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="OTHER">Other…</SelectItem>
                    </SelectContent>
                  </Select>
                  {currencySelectorValue === 'OTHER' && (
                    <div className="grid gap-2">
                      <Label htmlFor="currency_code_custom">Custom ISO code</Label>
                      <Input
                        id="currency_code_custom"
                        placeholder="e.g. JPY"
                        value={settingsForm.currency_code}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            currency_code: normalizeCurrencyCode(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="grid gap-2 lg:w-72">
                  <Label htmlFor="default_hourly_rate">
                    Default Hourly Rate ({settingsForm.currency_code})
                  </Label>
                  <Input
                    id="default_hourly_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={settingsForm.default_hourly_rate}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        default_hourly_rate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <Button
                  className="lg:self-end"
                  onClick={() => saveSettingsMutation.mutate(settingsForm)}
                  disabled={saveSettingsMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Pricing
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>
                Manage your ClassCal subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-semibold">Free Plan</p>
                  <p className="text-sm text-muted-foreground">
                    You&apos;re currently on the free demo plan
                  </p>
                </div>
                <Button variant="outline">Upgrade</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification settings</CardTitle>
              <CardDescription>
                Manage how and when you receive ClassCal notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Notification preferences will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar-sync" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendar sync</CardTitle>
              <CardDescription>
                Connect external calendars to keep your schedule in sync.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Calendar sync setup will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

