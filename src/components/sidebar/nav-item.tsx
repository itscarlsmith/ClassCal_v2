'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { Badge } from '@/components/ui/badge'

interface NavItemProps {
  label: string
  icon: React.ReactNode
  href?: string
  sectionKey?: string
  badge?: number
  children?: React.ReactNode
}

export function NavItem({ label, icon, href, sectionKey, badge, children }: NavItemProps) {
  const pathname = usePathname()
  const { sidebarExpanded, toggleSidebarSection } = useAppStore()
  
  const isExpandable = !!sectionKey && !!children
  const isExpanded = sectionKey ? sidebarExpanded[sectionKey] : false
  const isActive = href ? pathname === href || pathname.startsWith(href + '/') : false
  
  const handleClick = () => {
    if (isExpandable && sectionKey) {
      toggleSidebarSection(sectionKey)
    }
  }
  
  const content = (
    <>
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge 
          variant="secondary" 
          className="ml-auto h-5 min-w-5 px-1.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        >
          {badge}
        </Badge>
      )}
      {isExpandable && (
        <ChevronDown 
          className={cn(
            'w-4 h-4 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )} 
        />
      )}
    </>
  )
  
  if (isExpandable) {
    return (
      <div>
        <button
          onClick={handleClick}
          className={cn(
            'nav-item w-full',
            isExpanded && 'bg-accent/50'
          )}
        >
          {content}
        </button>
        {isExpanded && children && (
          <div className="mt-1 space-y-0.5 relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[22px] top-0 bottom-2 w-px bg-border" />
            {children}
          </div>
        )}
      </div>
    )
  }
  
  if (href) {
    return (
      <Link href={href} className={cn('nav-item', isActive && 'active')}>
        {content}
      </Link>
    )
  }
  
  return (
    <button className="nav-item w-full" onClick={handleClick}>
      {content}
    </button>
  )
}

interface NavSubItemProps {
  label: string
  href: string
  badge?: number
}

export function NavSubItem({ label, href, badge }: NavSubItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href
  
  return (
    <Link 
      href={href} 
      className={cn(
        'nav-item-nested',
        isActive && 'active'
      )}
    >
      {/* Horizontal connecting line from vertical bar */}
      <div className="absolute left-[22px] top-1/2 -translate-y-1/2 w-3 h-px bg-border" />
      <span className="ml-4 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge 
          variant="secondary" 
          className="ml-auto h-4 min-w-4 px-1 text-[10px] font-medium"
        >
          {badge}
        </Badge>
      )}
    </Link>
  )
}

