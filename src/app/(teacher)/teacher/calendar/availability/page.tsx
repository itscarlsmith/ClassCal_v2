'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Clock, Save, Pencil, X, CalendarPlus, CalendarDays } from 'lucide-react'
import { format, isPast, startOfDay, isFuture, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import type { AvailabilityBlock } from '@/types/database'
import { useAppStore } from '@/store/app-store'

const days = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const timeSlots = Array.from({ length: 32 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6 // Start at 6 AM
  const minute = i % 2 === 0 ? '00' : '30'
  const time = `${hour.toString().padStart(2, '0')}:${minute}`
  const label = `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
  return { value: time, label }
})

export default function AvailabilityPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { user: storeUser } = useAppStore()

  const { data: authUser } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },
  })

  const teacherId = authUser?.id || storeUser?.id || null

  // State for new weekly block
  const [newBlock, setNewBlock] = useState<{ day: number; start: string; end: string } | null>(null)
  
  // State for editing weekly block
  const [editingBlock, setEditingBlock] = useState<{ id: string; start: string; end: string } | null>(null)
  
  // State for new one-time block
  const [oneTimeDate, setOneTimeDate] = useState<Date | undefined>(undefined)
  const [oneTimeStart, setOneTimeStart] = useState('09:00')
  const [oneTimeEnd, setOneTimeEnd] = useState('17:00')
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Fetch availability blocks
  const { data: blocks, isLoading } = useQuery({
    queryKey: ['availability', teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('day_of_week')
        .order('start_time')
      if (error) throw error
      return data as AvailabilityBlock[]
    },
  })

  // Separate weekly and one-time blocks
  const weeklyBlocks = blocks?.filter((b) => b.is_recurring && b.day_of_week !== null) || []
  const oneTimeBlocks = blocks?.filter((b) => !b.is_recurring && b.specific_date !== null) || []

  // Group weekly blocks by day
  const blocksByDay = days.map((day) => ({
    ...day,
    blocks: weeklyBlocks.filter((b) => b.day_of_week === day.value),
  }))

  // Sort one-time blocks: upcoming first (chronologically), then past
  const sortedOneTimeBlocks = [...oneTimeBlocks].sort((a, b) => {
    if (!a.specific_date || !b.specific_date) return 0
    const dateA = new Date(a.specific_date + 'T00:00:00')
    const dateB = new Date(b.specific_date + 'T00:00:00')
    const isAPast = isPast(startOfDay(dateA)) && !isToday(dateA)
    const isBPast = isPast(startOfDay(dateB)) && !isToday(dateB)
    
    // Upcoming dates come first
    if (isAPast !== isBPast) return isAPast ? 1 : -1
    
    // Within same category, sort chronologically (upcoming) or reverse chronologically (past)
    return isAPast
      ? dateB.getTime() - dateA.getTime()
      : dateA.getTime() - dateB.getTime()
  })

  // Separate upcoming and past one-time blocks
  const upcomingOneTimeBlocks = sortedOneTimeBlocks.filter((b) => {
    if (!b.specific_date) return false
    const blockDate = new Date(b.specific_date + 'T00:00:00')
    return isFuture(startOfDay(blockDate)) || isToday(blockDate)
  })
  const pastOneTimeBlocks = sortedOneTimeBlocks.filter((b) => {
    if (!b.specific_date) return false
    const blockDate = new Date(b.specific_date + 'T00:00:00')
    return isPast(startOfDay(blockDate)) && !isToday(blockDate)
  })

  // Add weekly availability mutation
  const addBlockMutation = useMutation({
    mutationFn: async ({ day_of_week, start_time, end_time }: { 
      day_of_week: number
      start_time: string
      end_time: string 
    }) => {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('availability_blocks').insert({
        teacher_id: userData.user?.id,
        day_of_week,
        start_time,
        end_time,
        is_recurring: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast.success('Availability added')
    },
    onError: () => {
      toast.error('Failed to add availability')
    },
  })

  // Update availability mutation
  const updateBlockMutation = useMutation({
    mutationFn: async ({ id, start_time, end_time }: { 
      id: string
      start_time: string
      end_time: string 
    }) => {
      const { error } = await supabase
        .from('availability_blocks')
        .update({ start_time, end_time })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast.success('Availability updated')
      setEditingBlock(null)
    },
    onError: () => {
      toast.error('Failed to update availability')
    },
  })

  // Delete availability mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('availability_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast.success('Availability removed')
    },
    onError: () => {
      toast.error('Failed to remove availability')
    },
  })

  // Add one-time availability mutation
  const addOneTimeBlockMutation = useMutation({
    mutationFn: async ({ specific_date, start_time, end_time }: { 
      specific_date: string
      start_time: string
      end_time: string 
    }) => {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('availability_blocks').insert({
        teacher_id: userData.user?.id,
        specific_date,
        start_time,
        end_time,
        is_recurring: false,
        day_of_week: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast.success('One-time availability added')
      setOneTimeDate(undefined)
      setOneTimeStart('09:00')
      setOneTimeEnd('17:00')
    },
    onError: () => {
      toast.error('Failed to add one-time availability')
    },
  })

  const handleAddBlock = (dayValue: number) => {
    setNewBlock({ day: dayValue, start: '09:00', end: '17:00' })
  }

  const handleSaveNewBlock = () => {
    if (!newBlock) return
    if (newBlock.end <= newBlock.start) {
      toast.error('End time must be after start time')
      return
    }
    addBlockMutation.mutate({
      day_of_week: newBlock.day,
      start_time: newBlock.start,
      end_time: newBlock.end,
    })
    setNewBlock(null)
  }

  const handleStartEdit = (block: AvailabilityBlock) => {
    setEditingBlock({
      id: block.id,
      start: block.start_time,
      end: block.end_time,
    })
  }

  const handleSaveEdit = () => {
    if (!editingBlock) return
    if (editingBlock.end <= editingBlock.start) {
      toast.error('End time must be after start time')
      return
    }
    updateBlockMutation.mutate({
      id: editingBlock.id,
      start_time: editingBlock.start,
      end_time: editingBlock.end,
    })
  }

  const handleSaveOneTimeBlock = () => {
    if (!oneTimeDate) {
      toast.error('Please select a date')
      return
    }
    if (oneTimeEnd <= oneTimeStart) {
      toast.error('End time must be after start time')
      return
    }
    addOneTimeBlockMutation.mutate({
      specific_date: format(oneTimeDate, 'yyyy-MM-dd'),
      start_time: oneTimeStart,
      end_time: oneTimeEnd,
    })
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Weekly Schedule
          </CardTitle>
          <CardDescription>
            Students can only book lessons during your available times
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            blocksByDay.map((day) => (
              <div key={day.value} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{day.label}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddBlock(day.value)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Time
                  </Button>
                </div>

                {day.blocks.length > 0 ? (
                  <div className="space-y-2">
                    {day.blocks.map((block) => (
                      <div
                        key={block.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                      >
                        {editingBlock?.id === block.id ? (
                          // Edit mode
                          <>
                            <Select
                              value={editingBlock.start}
                              onValueChange={(value) =>
                                setEditingBlock({ ...editingBlock, start: value })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((slot) => (
                                  <SelectItem key={slot.value} value={slot.value}>
                                    {slot.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-muted-foreground">to</span>
                            <Select
                              value={editingBlock.end}
                              onValueChange={(value) =>
                                setEditingBlock({ ...editingBlock, end: value })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((slot) => (
                                  <SelectItem key={slot.value} value={slot.value}>
                                    {slot.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex-1" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingBlock(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={updateBlockMutation.isPending}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                          </>
                        ) : (
                          // View mode
                          <>
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatTime(block.start_time)} - {formatTime(block.end_time)}
                            </span>
                            <div className="flex-1" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleStartEdit(block)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteBlockMutation.mutate(block.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    Not available
                  </p>
                )}

                {/* New block form */}
                {newBlock?.day === day.value && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Select
                      value={newBlock.start}
                      onValueChange={(value) =>
                        setNewBlock({ ...newBlock, start: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>to</span>
                    <Select
                      value={newBlock.end}
                      onValueChange={(value) =>
                        setNewBlock({ ...newBlock, end: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setNewBlock(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveNewBlock}
                      disabled={addBlockMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </div>
                )}

                {day.value < 6 && <div className="border-t border-border" />}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* One-Time Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5" />
            One-Time Availability
          </CardTitle>
          <CardDescription>
            Add extra availability for specific dates outside your regular schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add new one-time block */}
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[200px] justify-start text-left font-normal',
                    !oneTimeDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {oneTimeDate ? format(oneTimeDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={oneTimeDate}
                  onSelect={(date) => {
                    setOneTimeDate(date)
                    setDatePickerOpen(false)
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
            
            <Select value={oneTimeStart} onValueChange={setOneTimeStart}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <span className="text-muted-foreground">to</span>
            
            <Select value={oneTimeEnd} onValueChange={setOneTimeEnd}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex-1" />
            
            <Button
              onClick={handleSaveOneTimeBlock}
              disabled={addOneTimeBlockMutation.isPending || !oneTimeDate}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {/* List of upcoming one-time blocks */}
          {upcomingOneTimeBlocks.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Upcoming extra availability</h4>
              {upcomingOneTimeBlocks.map((block) => {
                const blockDate = block.specific_date ? new Date(block.specific_date + 'T00:00:00') : null
                const isTodayBlock = blockDate && isToday(blockDate)
                
                return (
                  <div
                    key={block.id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg",
                      isTodayBlock ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                    )}
                  >
                    <CalendarDays className={cn("w-4 h-4", isTodayBlock ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium">
                      {blockDate && format(blockDate, 'EEE, MMM d, yyyy')}
                    </span>
                    {isTodayBlock && (
                      <Badge variant="outline" className="text-xs">Today</Badge>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <span>
                      {formatTime(block.start_time)} - {formatTime(block.end_time)}
                    </span>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteBlockMutation.mutate(block.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No upcoming one-time availability blocks scheduled
            </p>
          )}

          {/* List of past one-time blocks */}
          {pastOneTimeBlocks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Past extra availability</h4>
              {pastOneTimeBlocks.slice(0, 5).map((block) => (
                <div
                  key={block.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 opacity-60"
                >
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {block.specific_date && format(new Date(block.specific_date + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span>
                    {formatTime(block.start_time)} - {formatTime(block.end_time)}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteBlockMutation.mutate(block.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {pastOneTimeBlocks.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  + {pastOneTimeBlocks.length - 5} more past entries
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Students will only see available time slots when booking.</p>
          <p>• Add multiple time blocks per day for split schedules.</p>
          <p>• Use one-time availability for extra hours on specific dates.</p>
          <p>• Buffer time between lessons can be set in Settings.</p>
        </CardContent>
      </Card>
    </div>
  )
}
