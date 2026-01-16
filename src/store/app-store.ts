import { create } from 'zustand'
import type { Profile, Student } from '@/types/database'

type DrawerType = 
  | 'student'
  | 'lesson'
  | 'booking'
  | 'homework'
  | 'payment'
  | 'package'
  | 'material'
  | 'message'
  | 'settings'
  | 'student-booking'
  | 'student-lesson'
  | 'student-homework'
  | null

interface DrawerState {
  type: DrawerType
  id: string | null
  data?: Record<string, unknown>
}

interface AppState {
  // User & Profile
  user: Profile | null
  setUser: (user: Profile | null) => void

  // Sidebar collapsed state (persisted)
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
  
  // Drawer state
  drawer: DrawerState
  openDrawer: (type: DrawerType, id?: string | null, data?: Record<string, unknown>) => void
  closeDrawer: () => void
  
  // Sidebar state
  sidebarExpanded: Record<string, boolean>
  toggleSidebarSection: (section: string) => void
  setSidebarExpanded: (section: string, expanded: boolean) => void
  
  // Selection state
  selectedStudentId: string | null
  setSelectedStudentId: (id: string | null) => void
  selectedLessonId: string | null
  setSelectedLessonId: (id: string | null) => void
  
  // Quick cache for frequently accessed data
  studentsCache: Student[]
  setStudentsCache: (students: Student[]) => void
  
  // UI state
  calendarView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
  setCalendarView: (view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => void
  calendarDate: Date
  setCalendarDate: (date: Date) => void
}

export const useAppStore = create<AppState>((set) => ({
  // User & Profile
  user: null,
  setUser: (user) => set({ user }),

  // Sidebar collapsed state
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) =>
    set(() => {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('classcal.sidebarCollapsed', collapsed ? '1' : '0')
        }
      } catch {
        // ignore storage failures
      }
      return { sidebarCollapsed: collapsed }
    }),
  toggleSidebarCollapsed: () =>
    set((state) => {
      const next = !state.sidebarCollapsed
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('classcal.sidebarCollapsed', next ? '1' : '0')
        }
      } catch {
        // ignore storage failures
      }
      return { sidebarCollapsed: next }
    }),
  
  // Drawer state
  drawer: { type: null, id: null },
  openDrawer: (type, id = null, data) => set({ drawer: { type, id, data } }),
  closeDrawer: () => set({ drawer: { type: null, id: null } }),
  
  // Sidebar state - Default expanded sections
  sidebarExpanded: {
    dashboard: true,
    calendar: false,
    lessons: false,
    students: false,
    homework: false,
    messages: false,
    library: false,
    finance: false,
    automation: false,
    settings: false,
    help: false,
  },
  toggleSidebarSection: (section) =>
    set((state) => ({
      sidebarExpanded: {
        ...state.sidebarExpanded,
        [section]: !state.sidebarExpanded[section],
      },
    })),
  setSidebarExpanded: (section, expanded) =>
    set((state) => ({
      sidebarExpanded: {
        ...state.sidebarExpanded,
        [section]: expanded,
      },
    })),
  
  // Selection state
  selectedStudentId: null,
  setSelectedStudentId: (id) => set({ selectedStudentId: id }),
  selectedLessonId: null,
  setSelectedLessonId: (id) => set({ selectedLessonId: id }),
  
  // Quick cache
  studentsCache: [],
  setStudentsCache: (students) => set({ studentsCache: students }),
  
  // UI state
  calendarView: 'timeGridWeek',
  setCalendarView: (view) => set({ calendarView: view }),
  calendarDate: new Date(),
  setCalendarDate: (date) => set({ calendarDate: date }),
}))

