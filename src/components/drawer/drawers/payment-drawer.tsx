'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  CreditCard,
  Trash2,
  Save,
  DollarSign,
  Package,
} from 'lucide-react'
import type { Payment, Package as PackageType } from '@/types/database'

interface PaymentDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

export function PaymentDrawer({ id, data }: PaymentDrawerProps) {
  const { closeDrawer, user } = useAppStore()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const isNew = !id || id === 'new'

  const [formData, setFormData] = useState({
    student_id: (data?.studentId as string) || '',
    package_id: '',
    amount: 0,
    credits_purchased: 0,
    status: 'pending',
    payment_method: 'card',
    transaction_id: '',
  })

  // Fetch payment data
  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await supabase
        .from('payments')
        .select('*, student:students(id, full_name, email), package:packages(id, name, credits, price)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !isNew && !!id,
  })

  // Fetch students for dropdown
  const { data: students } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, email')
        .eq('teacher_id', user?.id)
        .order('full_name')
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  // Fetch packages for dropdown
  const { data: packages } = useQuery({
    queryKey: ['packages-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('teacher_id', user?.id)
        .eq('is_active', true)
        .order('credits')
      if (error) throw error
      return data as PackageType[]
    },
    enabled: !!user?.id,
  })

  // Update form when payment data loads
  useEffect(() => {
    if (payment) {
      setFormData({
        student_id: payment.student_id,
        package_id: payment.package_id || '',
        amount: payment.amount,
        credits_purchased: payment.credits_purchased,
        status: payment.status,
        payment_method: payment.payment_method || 'card',
        transaction_id: payment.transaction_id || '',
      })
    }
  }, [payment])

  // When package is selected, auto-fill amount and credits
  const handlePackageChange = (packageId: string) => {
    const selectedPackage = packages?.find((p) => p.id === packageId)
    if (selectedPackage) {
      setFormData({
        ...formData,
        package_id: packageId,
        amount: selectedPackage.price,
        credits_purchased: selectedPackage.credits,
      })
    }
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        teacher_id: user?.id,
        package_id: data.package_id || null,
      }

      if (isNew) {
        // Create payment
        const { data: newPayment, error: paymentError } = await supabase
          .from('payments')
          .insert(payload)
          .select()
          .single()
        if (paymentError) throw paymentError

        // If payment is completed, add credits to student
        if (data.status === 'completed') {
          // Update student credits
          const { error: creditError } = await supabase.rpc('add_credits', {
            p_student_id: data.student_id,
            p_amount: data.credits_purchased,
          })
          
          // If RPC doesn't exist, update directly
          if (creditError) {
            const { data: student } = await supabase
              .from('students')
              .select('credits')
              .eq('id', data.student_id)
              .single()
            
            if (student) {
              await supabase
                .from('students')
                .update({ credits: student.credits + data.credits_purchased })
                .eq('id', data.student_id)
            }
          }

          // Record in ledger
          const { data: studentData } = await supabase
            .from('students')
            .select('credits')
            .eq('id', data.student_id)
            .single()

          await supabase.from('credit_ledger').insert({
            student_id: data.student_id,
            teacher_id: user?.id,
            amount: data.credits_purchased,
            balance_after: studentData?.credits || data.credits_purchased,
            description: `Purchased ${data.credits_purchased} credits`,
            payment_id: newPayment.id,
          })
        }

        return newPayment
      } else {
        const { data: updated, error } = await supabase
          .from('payments')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment', id] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success(isNew ? 'Payment recorded' : 'Payment updated')
      if (isNew) closeDrawer()
    },
    onError: (error) => {
      toast.error('Failed to save payment')
      console.error(error)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment deleted')
      closeDrawer()
    },
    onError: (error) => {
      toast.error('Failed to delete payment')
      console.error(error)
    },
  })

  const handleSave = () => {
    if (!formData.student_id || !formData.amount) {
      toast.error('Please fill in all required fields')
      return
    }
    saveMutation.mutate(formData)
  }

  return (
    <Drawer
      title={isNew ? 'Record Payment' : 'Payment Details'}
      subtitle={
        isNew
          ? 'Add a new payment record'
          : payment
          ? `${format(new Date(payment.created_at), 'MMM d, yyyy')}`
          : undefined
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
                if (confirm('Are you sure you want to delete this payment?')) {
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
            {isNew ? 'Record Payment' : 'Save Changes'}
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
          {/* Payment Summary (for existing) */}
          {!isNew && payment && (
            <div className="p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">${payment.amount.toFixed(2)}</span>
                <Badge
                  variant={payment.status === 'completed' ? 'default' : 'secondary'}
                  className={payment.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                >
                  {payment.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {payment.credits_purchased} credits purchased
              </p>
            </div>
          )}

          {/* Form Fields */}
          <DrawerSection title="Payment Details">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="student">Student *</Label>
                <Select
                  value={formData.student_id}
                  onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                  disabled={!isNew}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students?.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="package">Package (optional)</Label>
                <Select
                  value={formData.package_id}
                  onValueChange={handlePackageChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a package" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages?.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} - {pkg.credits} credits (${pkg.price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="credits">Credits</Label>
                  <Input
                    id="credits"
                    type="number"
                    min="0"
                    value={formData.credits_purchased}
                    onChange={(e) =>
                      setFormData({ ...formData, credits_purchased: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payment_method">Method</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="transaction_id">Transaction ID (optional)</Label>
                <Input
                  id="transaction_id"
                  value={formData.transaction_id}
                  onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                  placeholder="External reference number"
                />
              </div>
            </div>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  )
}

