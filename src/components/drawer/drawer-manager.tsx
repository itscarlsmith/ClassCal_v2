'use client'

import { useAppStore } from '@/store/app-store'
import { StudentDrawer } from './drawers/student-drawer'
import { LessonDrawer } from './drawers/lesson-drawer'
import { BookingDrawer } from './drawers/booking-drawer'
import { HomeworkDrawer } from './drawers/homework-drawer'
import { PaymentDrawer } from './drawers/payment-drawer'
import { PackageDrawer } from './drawers/package-drawer'
import { MaterialDrawer } from './drawers/material-drawer'
import { StudentBookingDrawer } from './drawers/student-booking-drawer'
import { StudentLessonDrawer } from './drawers/student-lesson-drawer'
import { StudentHomeworkDrawer } from './drawers/student-homework-drawer'

export function DrawerManager() {
  const { drawer } = useAppStore()

  if (!drawer.type) return null

  switch (drawer.type) {
    case 'student':
      return <StudentDrawer id={drawer.id} data={drawer.data} />
    case 'lesson':
      return <LessonDrawer id={drawer.id} data={drawer.data} />
    case 'booking':
      return <BookingDrawer id={drawer.id} data={drawer.data} />
    case 'homework':
      return <HomeworkDrawer id={drawer.id} data={drawer.data} />
    case 'payment':
      return <PaymentDrawer id={drawer.id} data={drawer.data} />
    case 'package':
      return <PackageDrawer id={drawer.id} data={drawer.data} />
    case 'material':
      return <MaterialDrawer id={drawer.id} data={drawer.data} />
    case 'student-booking':
      return <StudentBookingDrawer id={drawer.id} data={drawer.data} />
    case 'student-lesson':
      return <StudentLessonDrawer id={drawer.id} data={drawer.data} />
    case 'student-homework':
      return <StudentHomeworkDrawer id={drawer.id} data={drawer.data} />
    default:
      return null
  }
}

