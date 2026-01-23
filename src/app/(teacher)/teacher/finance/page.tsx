'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  DollarSign,
  TrendingUp,
  CreditCard,
  Package,
} from 'lucide-react'
import { format } from 'date-fns'
import type { Package as PackageType } from '@/types/database'
import { formatCurrency } from '@/lib/currency'

export default function FinancePage() {
  const { openDrawer } = useAppStore()
  const supabase = createClient()

  // Fetch payments
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('payments')
        .select('*, student:students(id, full_name, email), package:packages(id, name)')
        .eq('teacher_id', userData.user?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Fetch packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('teacher_id', userData.user?.id)
        .order('credits')
      if (error) throw error
      return data as PackageType[]
    },
  })

  const { data: teacherSettings } = useQuery({
    queryKey: ['teacher-settings'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('teacher_settings')
        .select('currency_code')
        .eq('teacher_id', userData.user?.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  // Calculate stats
  const totalEarnings = payments
    ?.filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0

  const thisMonthEarnings = payments
    ?.filter((p) => {
      const paymentDate = new Date(p.created_at)
      const now = new Date()
      return (
        p.status === 'completed' &&
        paymentDate.getMonth() === now.getMonth() &&
        paymentDate.getFullYear() === now.getFullYear()
      )
    })
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0

  const pendingPayments = payments?.filter((p) => p.status === 'pending').length || 0
  const currencyCode = teacherSettings?.currency_code ?? 'USD'

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground mt-1">
            Track your earnings, payments, and packages
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => openDrawer('package', 'new')}>
            <Package className="w-4 h-4 mr-2" />
            Create Package
          </Button>
          <Button onClick={() => openDrawer('payment', 'new')}>
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                <p className="stat-value mt-2">{formatCurrency(totalEarnings, currencyCode)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="stat-value mt-2">
                  {formatCurrency(thisMonthEarnings, currencyCode)}
                </p>
                <span className="stat-trend-positive mt-2">
                  <TrendingUp className="w-3 h-3" />
                  +15% vs last month
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="stat-value mt-2">{pendingPayments}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Packages</p>
                <p className="stat-value mt-2">
                  {packages?.filter((p) => p.is_active).length || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : payments && payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow
                        key={payment.id}
                        className="cursor-pointer"
                        onClick={() => openDrawer('payment', payment.id)}
                      >
                        <TableCell className="font-medium">
                          {payment.student?.full_name}
                        </TableCell>
                        <TableCell>{payment.package?.name || 'Custom'}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(Number(payment.amount), currencyCode)}
                        </TableCell>
                        <TableCell>{payment.credits_purchased}</TableCell>
                        <TableCell>
                          <Badge
                            variant={payment.status === 'completed' ? 'default' : 'secondary'}
                            className={
                              payment.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : payment.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(payment.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No payments yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => openDrawer('payment', 'new')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Record First Payment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packagesLoading ? (
              <div className="col-span-full flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : packages && packages.length > 0 ? (
              packages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                    !pkg.is_active ? 'opacity-60' : ''
                  }`}
                  onClick={() => openDrawer('package', pkg.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Package className="w-6 h-6 text-primary" />
                      </div>
                      {!pkg.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {pkg.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-bold">
                        {formatCurrency(Number(pkg.price), currencyCode)}
                      </span>
                      <span className="text-muted-foreground">
                        for {pkg.credits} credits
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {formatCurrency(Number(pkg.price) / pkg.credits, currencyCode)} per credit
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No packages yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => openDrawer('package', 'new')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Package
                </Button>
              </div>
            )}

            {/* Add Package Card */}
            {packages && packages.length > 0 && (
              <Card
                className="cursor-pointer border-dashed hover:border-primary transition-colors flex items-center justify-center min-h-[200px]"
                onClick={() => openDrawer('package', 'new')}
              >
                <CardContent className="text-center">
                  <Plus className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Add Package</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

