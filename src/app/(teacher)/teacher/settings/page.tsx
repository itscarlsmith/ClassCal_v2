'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useRouter } from 'next/navigation'
import type { Profile, TeacherSettings } from '@/types/database'

export default function SettingsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

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
    onSuccess: (loadedProfile) => {
      if (!loadedProfile) return
      setProfileForm({
        full_name: loadedProfile.full_name,
        email: loadedProfile.email,
        timezone: loadedProfile.timezone,
      })
    },
  })

  // Fetch teacher settings
  useQuery({
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
    onSuccess: (loadedSettings) => {
      if (!loadedSettings) return
      setSettingsForm({
        cancellation_policy_hours: loadedSettings.cancellation_policy_hours,
        default_lesson_duration: loadedSettings.default_lesson_duration,
        booking_buffer_hours: loadedSettings.booking_buffer_hours,
        max_advance_booking_days: loadedSettings.max_advance_booking_days,
      })
    },
  })

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    timezone: 'America/New_York',
  })

  const [settingsForm, setSettingsForm] = useState({
    cancellation_policy_hours: 24,
    default_lesson_duration: 60,
    booking_buffer_hours: 2,
    max_advance_booking_days: 30,
  })

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
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-settings'] })
      toast.success('Settings updated')
    },
    onError: () => {
      toast.error('Failed to update settings')
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
      <Tabs defaultValue="profile">
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
                    value={settingsForm.default_lesson_duration.toString()}
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
      </Tabs>
    </div>
  )
}

