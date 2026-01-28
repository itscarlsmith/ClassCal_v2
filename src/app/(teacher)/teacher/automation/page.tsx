'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Zap, Bell, BookOpen, CreditCard } from 'lucide-react'
import type { AutomationRule } from '@/types/database'

export default function AutomationPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch automation rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user?.id) return []
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('teacher_id', userData.user.id)
        .order('type')
      if (error) throw error
      return data as AutomationRule[]
    },
  })

  // Toggle rule mutation
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('automation_rules')
        .update({ is_enabled })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      toast.success('Automation updated')
    },
    onError: () => {
      toast.error('Failed to update automation')
    },
  })

  // Update rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, trigger_hours_before, message_template }: Partial<AutomationRule>) => {
      const { error } = await supabase
        .from('automation_rules')
        .update({ trigger_hours_before, message_template })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      toast.success('Rule updated')
    },
    onError: () => {
      toast.error('Failed to update rule')
    },
  })

  // Create default rules if none exist
  const createDefaultRulesMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      
      const defaultRules = [
        {
          teacher_id: userData.user?.id,
          type: 'lesson_reminder_24h',
          is_enabled: true,
          trigger_hours_before: 24,
          message_template: 'Hi {student_name}! Just a reminder that we have a lesson scheduled for tomorrow at {lesson_time}. See you then!',
        },
        {
          teacher_id: userData.user?.id,
          type: 'lesson_reminder_1h',
          is_enabled: true,
          trigger_hours_before: 1,
          message_template: 'Your lesson starts in 1 hour! Here\'s the meeting link: {meeting_url}',
        },
        {
          teacher_id: userData.user?.id,
          type: 'homework_reminder',
          is_enabled: true,
          trigger_hours_before: 24,
          message_template: 'Hi {student_name}! Your homework "{homework_title}" is due tomorrow. Don\'t forget to submit it!',
        },
        {
          teacher_id: userData.user?.id,
          type: 'payment_reminder',
          is_enabled: false,
          trigger_hours_before: 72,
          message_template: 'Hi {student_name}! Your lesson credits are running low ({credits_remaining} remaining). Consider purchasing more to continue booking lessons.',
        },
      ]

      const { error } = await supabase.from('automation_rules').insert(defaultRules)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      toast.success('Default rules created')
    },
    onError: () => {
      toast.error('Failed to create rules')
    },
  })

  const getRulesByType = (type: string) => {
    return rules?.filter((r) => r.type.startsWith(type)) || []
  }

  const lessonRules = getRulesByType('lesson_reminder')
  const homeworkRules = getRulesByType('homework_reminder')
  const paymentRules = getRulesByType('payment_reminder')

  const RuleCard = ({ rule, icon, title, description }: { 
    rule: AutomationRule
    icon: React.ReactNode
    title: string
    description: string 
  }) => (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Switch
            checked={rule.is_enabled}
            onCheckedChange={(checked) =>
              toggleRuleMutation.mutate({ id: rule.id, is_enabled: checked })
            }
          />
        </div>
        
        {rule.is_enabled && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="grid gap-2">
              <Label className="text-xs">Send {rule.trigger_hours_before} hours before</Label>
              <Input
                type="number"
                min="1"
                value={rule.trigger_hours_before || ''}
                onChange={(e) =>
                  updateRuleMutation.mutate({
                    id: rule.id,
                    trigger_hours_before: parseInt(e.target.value) || 1,
                  })
                }
                className="h-8"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Message Template</Label>
              <Textarea
                value={rule.message_template || ''}
                onChange={(e) =>
                  updateRuleMutation.mutate({
                    id: rule.id,
                    message_template: e.target.value,
                  })
                }
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Available variables: {'{student_name}'}, {'{lesson_time}'}, {'{meeting_url}'}, {'{homework_title}'}, {'{credits_remaining}'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <Zap className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <Button onClick={() => createDefaultRulesMutation.mutate()}>
            <Zap className="w-4 h-4 mr-2" />
            Set Up Default Automations
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* Lesson Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Lesson Reminders
          </CardTitle>
          <CardDescription>
            Automatically remind students about upcoming lessons
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lessonRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              icon={<Bell className="w-5 h-5 text-primary" />}
              title={`${rule.trigger_hours_before} Hour${rule.trigger_hours_before === 1 ? '' : 's'} Before`}
              description="Send a reminder before the lesson"
            />
          ))}
          {lessonRules.length === 0 && (
            <p className="text-center py-4 text-muted-foreground">
              No lesson reminder rules configured
            </p>
          )}
        </CardContent>
      </Card>

      {/* Homework Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Homework Reminders
          </CardTitle>
          <CardDescription>
            Remind students about homework due dates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {homeworkRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              icon={<BookOpen className="w-5 h-5 text-primary" />}
              title="Before Due Date"
              description="Send a reminder before homework is due"
            />
          ))}
          {homeworkRules.length === 0 && (
            <p className="text-center py-4 text-muted-foreground">
              No homework reminder rules configured
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Reminders
          </CardTitle>
          <CardDescription>
            Remind students when their credits are running low
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              icon={<CreditCard className="w-5 h-5 text-primary" />}
              title="Low Credits Warning"
              description="Notify when student credits are low"
            />
          ))}
          {paymentRules.length === 0 && (
            <p className="text-center py-4 text-muted-foreground">
              No payment reminder rules configured
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

