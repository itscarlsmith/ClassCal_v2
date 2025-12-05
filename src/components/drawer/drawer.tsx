'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DrawerProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  className?: string
  width?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

const widthClasses = {
  sm: 'w-[360px]',
  md: 'w-[480px]',
  lg: 'w-[600px]',
  xl: 'w-[720px]',
}

export function Drawer({ children, title, subtitle, className, width = 'md', footer }: DrawerProps) {
  const { drawer, closeDrawer } = useAppStore()
  const isOpen = drawer.type !== null

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeDrawer()
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeDrawer])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]"
        onClick={closeDrawer}
      />
      
      {/* Drawer Panel */}
      <div 
        className={cn(
          'fixed right-0 top-0 h-screen bg-card border-l border-border shadow-2xl z-50',
          'drawer-enter flex flex-col',
          widthClasses[width],
          className
        )}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-border">
            <div>
              {title && (
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              )}
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2"
              onClick={closeDrawer}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        )}
        
        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6">
            {children}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        {footer && footer}
      </div>
    </>
  )
}

// Drawer section component for consistent styling
interface DrawerSectionProps {
  title?: string
  children: React.ReactNode
  className?: string
}

export function DrawerSection({ title, children, className }: DrawerSectionProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

// Drawer footer for actions
interface DrawerFooterProps {
  children: React.ReactNode
  className?: string
}

export function DrawerFooter({ children, className }: DrawerFooterProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-6 py-4 border-t border-border bg-muted/30',
      className
    )}>
      {children}
    </div>
  )
}

