'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Users, CreditCard, Mail, Phone } from 'lucide-react'
import { useState } from 'react'
import type { Student } from '@/types/database'
import { formatCurrency } from '@/lib/currency'
import { getEffectiveHourlyRate } from '@/lib/pricing'

export default function StudentsPage() {
  const { openDrawer } = useAppStore()
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch students
  const { data: students, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', userData.user?.id)
        .order('full_name')
      if (error) throw error
      return data as Student[]
    },
  })

  const { data: teacherSettings } = useQuery({
    queryKey: ['teacher-settings'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('teacher_settings')
        .select('default_hourly_rate, currency_code')
        .eq('teacher_id', userData.user?.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const filteredStudents = students?.filter(
    (student) =>
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Stats
  const totalStudents = students?.length || 0
  const totalCredits = students?.reduce((sum, s) => sum + s.credits, 0) || 0
  const defaultHourlyRate = teacherSettings?.default_hourly_rate ?? 45
  const currencyCode = teacherSettings?.currency_code ?? 'USD'
  const avgRate =
    students?.length
      ? students.reduce((sum, s) => {
          const effectiveRate = getEffectiveHourlyRate({
            studentHourlyRate: s.hourly_rate,
            teacherDefaultHourlyRate: defaultHourlyRate,
          })
          return sum + effectiveRate
        }, 0) / students.length
      : 0

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">
            Manage your students and their information
          </p>
        </div>
        <Button onClick={() => openDrawer('student', 'new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold">{totalStudents}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold">{totalCredits}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <span className="text-lg font-bold text-purple-600">$</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Hourly Rate</p>
              <p className="text-2xl font-bold">{formatCurrency(avgRate, currencyCode)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Student List</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredStudents && filteredStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Credits</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow 
                    key={student.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDrawer('student', student.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={student.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{student.full_name}</p>
                          {student.notes && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {student.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          {student.email}
                        </div>
                        {student.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {student.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary"
                        className={student.credits > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                      >
                        {student.credits} credits
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div className="flex flex-col items-end">
                        <span>
                          {formatCurrency(
                            getEffectiveHourlyRate({
                              studentHourlyRate: student.hourly_rate,
                              teacherDefaultHourlyRate: defaultHourlyRate,
                            }),
                            currencyCode
                          )}
                        </span>
                        {student.hourly_rate == null && (
                          <span className="text-xs text-muted-foreground">Default</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDrawer('student', student.id)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No students found' : 'No students yet'}
              </p>
              {!searchQuery && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => openDrawer('student', 'new')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Student
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

