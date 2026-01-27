'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { getEffectiveHourlyRate } from '@/lib/pricing'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

type StudentRow = {
  id: string
  teacher_id: string
  credits: number
  hourly_rate: number | null
}

type TeacherProfile = {
  id: string
  full_name: string
  email: string | null
}

type TeacherSettings = {
  teacher_id: string
  default_hourly_rate: number
  currency_code: string
  stripe_account_id: string | null
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
  stripe_onboarding_completed: boolean
}

type CreditLedgerEntry = {
  id: string
  student_id: string
  teacher_id: string
  amount: number
  balance_after: number
  description: string
  type: string
  lesson_id: string | null
  created_at: string
}

export default function StudentFinancePage() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const stripeStatus = (() => {
    const direct = searchParams.get('stripe')
    if (direct === 'success' || direct === 'cancelled') return direct
    const legacy = searchParams.get('payment')
    if (legacy === 'success' || legacy === 'cancelled') return legacy
    return null
  })()
  const [creditsByTeacherId, setCreditsByTeacherId] = useState<Record<string, number>>({})
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null)
  const stripeToastShownRef = useRef(false)

  const { data: students, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['student-finance-students'],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) throw userError || new Error('Not authenticated')
      const { data, error } = await supabase
        .from('students')
        .select('id, teacher_id, credits, hourly_rate')
        .eq('user_id', userData.user.id)
      if (error) throw error
      return (data || []) as StudentRow[]
    },
  })

  const studentIds = useMemo(
    () => Array.from(new Set((students || []).map((student) => student.id))),
    [students]
  )

  const teacherIds = useMemo(
    () => Array.from(new Set((students || []).map((student) => student.teacher_id))),
    [students]
  )

  const { data: teachers } = useQuery({
    queryKey: ['student-finance-teachers', teacherIds],
    enabled: teacherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', teacherIds)
      if (error) throw error
      return (data || []) as TeacherProfile[]
    },
  })

  const { data: teacherSettings } = useQuery({
    queryKey: ['student-finance-teacher-settings', teacherIds],
    enabled: teacherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_settings')
        .select(
          'teacher_id, default_hourly_rate, currency_code, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_onboarding_completed'
        )
        .in('teacher_id', teacherIds)
      if (error) throw error
      return (data || []) as TeacherSettings[]
    },
  })

  const { data: ledgerEntries, isLoading: isLedgerLoading } = useQuery({
    queryKey: ['student-finance-ledger', studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_ledger')
        .select(
          'id, student_id, teacher_id, amount, balance_after, description, type, lesson_id, created_at'
        )
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as CreditLedgerEntry[]
    },
  })

  const teachersById = useMemo(() => {
    return new Map((teachers || []).map((teacher) => [teacher.id, teacher]))
  }, [teachers])

  const settingsByTeacherId = useMemo(() => {
    return new Map(
      (teacherSettings || []).map((settings) => [settings.teacher_id, settings])
    )
  }, [teacherSettings])

  const ledgerByTeacherId = useMemo(() => {
    const grouped = new Map<string, CreditLedgerEntry[]>()
    for (const entry of ledgerEntries || []) {
      const existing = grouped.get(entry.teacher_id) || []
      existing.push(entry)
      grouped.set(entry.teacher_id, existing)
    }
    return grouped
  }, [ledgerEntries])

  const groups = useMemo(() => {
    const grouped = new Map<string, StudentRow[]>()
    for (const student of students || []) {
      const existing = grouped.get(student.teacher_id) || []
      existing.push(student)
      grouped.set(student.teacher_id, existing)
    }
    return Array.from(grouped.entries()).map(([teacherId, studentRows]) => {
      const settings = settingsByTeacherId.get(teacherId)
      const teacherDefaultRate = settings?.default_hourly_rate ?? 45
      const currencyCode = settings?.currency_code ?? 'USD'
      const stripeReady = Boolean(
        settings?.stripe_charges_enabled && settings?.stripe_payouts_enabled
      )
      const primaryStudent = studentRows[0]
      const primaryRate = primaryStudent
        ? getEffectiveHourlyRate({
            studentHourlyRate: primaryStudent.hourly_rate,
            teacherDefaultHourlyRate: teacherDefaultRate,
          })
        : teacherDefaultRate
      const effectiveRates = studentRows.map((student) =>
        getEffectiveHourlyRate({
          studentHourlyRate: student.hourly_rate,
          teacherDefaultHourlyRate: teacherDefaultRate,
        })
      )
      const uniqueRates = Array.from(new Set(effectiveRates))
      const rateLabel =
        uniqueRates.length === 1
          ? formatCurrency(uniqueRates[0], currencyCode)
          : 'Multiple rates'
      const creditsAvailable = studentRows.reduce((sum, student) => sum + student.credits, 0)
      const ledger = ledgerByTeacherId.get(teacherId) || []
      const closedLessonIds = new Set(
        ledger
          .filter((entry) => entry.lesson_id && ['return', 'consume'].includes(entry.type))
          .map((entry) => entry.lesson_id as string)
      )
      const reservedCount = ledger.filter(
        (entry) =>
          entry.type === 'reserve' &&
          entry.lesson_id &&
          !closedLessonIds.has(entry.lesson_id)
      ).length
      return {
        teacherId,
        studentRows,
        teacherDefaultRate,
        rateLabel,
        currencyCode,
        creditsAvailable,
        reservedCount,
        ledger,
        stripeReady,
        primaryStudentId: primaryStudent?.id ?? '',
        primaryRate,
      }
    })
  }, [students, settingsByTeacherId, ledgerByTeacherId])

  const handleBuyCredits = async (group: (typeof groups)[number]) => {
    if (!group.primaryStudentId) {
      toast.error('Student record not found for checkout.')
      return
    }

    const credits = creditsByTeacherId[group.teacherId] ?? 1
    if (!Number.isInteger(credits) || credits <= 0) {
      toast.error('Please enter a valid number of credits.')
      return
    }

    setCheckoutLoadingId(group.teacherId)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: group.teacherId,
          studentId: group.primaryStudentId,
          credits,
        }),
      })

      const payload = (await response.json()) as { url?: string; error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to start Stripe checkout.')
      }

      if (!payload.url) {
        throw new Error('Stripe checkout URL is missing.')
      }

      window.location.assign(payload.url)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start checkout.'
      toast.error(message)
    } finally {
      setCheckoutLoadingId(null)
    }
  }

  useEffect(() => {
    if (!stripeStatus) return

    const toastDuration = 4000
    if (stripeToastShownRef.current) return
    stripeToastShownRef.current = true

    // Delay one tick so the global <Toaster /> has definitely mounted/subscribed.
    const toastTimerId = window.setTimeout(() => {
      if (stripeStatus === 'success') {
        toast.success('Payment successful — credits have been added', { duration: toastDuration })
      } else if (stripeStatus === 'cancelled') {
        toast('Payment cancelled — no credits were added', { duration: toastDuration })
      }
    }, 0)

    const timeoutId = window.setTimeout(() => {
      router.replace(pathname, { scroll: false })
    }, toastDuration + 50)

    return () => {
      window.clearTimeout(toastTimerId)
      window.clearTimeout(timeoutId)
    }
  }, [stripeStatus, pathname, router])

  return (
    <section className="p-8 space-y-6">
      {(isStudentsLoading || isLedgerLoading) && (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!isStudentsLoading && groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No finance data yet. Ask your teacher to add you as a student.
          </CardContent>
        </Card>
      )}

      {groups.map((group) => {
        const teacher = teachersById.get(group.teacherId)
        return (
          <Card key={group.teacherId}>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center justify-between gap-4 lg:contents">
                  <div className="min-w-0 lg:order-1">
                    <CardTitle>{teacher?.full_name || 'Teacher'}</CardTitle>
                    {teacher?.email && (
                      <CardDescription>{teacher.email}</CardDescription>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 lg:order-3">
                    <div className="flex flex-col items-end gap-2">
                      <div className="grid gap-1">
                        <label className="text-xs text-muted-foreground" htmlFor={`credits-${group.teacherId}`}>
                          Credits to buy
                        </label>
                        <Input
                          id={`credits-${group.teacherId}`}
                          type="number"
                          min={1}
                          step={1}
                          value={creditsByTeacherId[group.teacherId] ?? 1}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value)
                            setCreditsByTeacherId((prev) => ({
                              ...prev,
                              [group.teacherId]: Number.isFinite(nextValue) ? nextValue : 1,
                            }))
                          }}
                          className="w-28 text-right"
                        />
                        <p className="text-xs text-muted-foreground">
                          Total:{' '}
                          {formatCurrency(
                            (creditsByTeacherId[group.teacherId] ?? 1) * group.primaryRate,
                            group.currencyCode
                          )}
                        </p>
                      </div>
                      <Button
                        className="lg:order-3"
                        disabled={!group.stripeReady || checkoutLoadingId === group.teacherId}
                        onClick={() => handleBuyCredits(group)}
                      >
                        Buy credits
                      </Button>
                    </div>
                    {!group.stripeReady && (
                      <p className="text-xs text-muted-foreground">
                        Teacher has not completed payment setup
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-center lg:flex-1 lg:order-2">
                  <div className="flex flex-col items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm text-muted-foreground cursor-help">Credits available</p>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      You can use available credits to book lessons.
                    </TooltipContent>
                  </Tooltip>
                  <p className="text-2xl font-semibold">{group.creditsAvailable}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm text-muted-foreground cursor-help">Credits reserved</p>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Reserved credits are held for upcoming scheduled lessons.
                    </TooltipContent>
                  </Tooltip>
                  <p className="text-2xl font-semibold">{group.reservedCount}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                  <p className="text-sm text-muted-foreground">Price per lesson</p>
                  <p className="text-2xl font-semibold">{group.rateLabel}</p>
                  </div>
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="history">
                  <AccordionTrigger>Transaction history</AccordionTrigger>
                  <AccordionContent>
                    {group.ledger.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No transactions yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {group.ledger.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{entry.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.created_at), 'MMM d, yyyy • h:mm a')}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary" className="uppercase text-[10px]">
                                {entry.type}
                              </Badge>
                              <span className="text-sm font-semibold">
                                {entry.amount > 0 ? '+' : ''}
                                {entry.amount}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Balance {entry.balance_after}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
