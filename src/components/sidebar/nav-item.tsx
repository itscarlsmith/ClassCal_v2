'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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
  const { sidebarExpanded, toggleSidebarSection, sidebarCollapsed } = useAppStore()
  
  const isExpandable = !!sectionKey && !!children
  const isExpanded = !sidebarCollapsed && sectionKey ? sidebarExpanded[sectionKey] : false
  const directActive = href ? pathname === href || pathname.startsWith(href + '/') : false

  const childHrefs = React.useMemo(() => {
    if (!children) return []
    return React.Children.toArray(children)
      .filter((child): child is React.ReactElement<NavSubItemProps> => React.isValidElement(child))
      .map((child) => child.props.href)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  }, [children])

  const childActive = React.useMemo(() => {
    if (!childHrefs.length) return false
    return childHrefs.some((h) => pathname === h || pathname.startsWith(h + '/'))
  }, [childHrefs, pathname])

  const isActive = directActive || childActive
  
  const handleClick = () => {
    if (isExpandable && sectionKey) {
      toggleSidebarSection(sectionKey)
    }
  }
  
  // Collapsed mode: icon-only with tooltip. For expandable sections, show a popover with subitems.
  if (sidebarCollapsed) {
    const triggerClass = cn(
      'nav-item w-full justify-center px-2',
      isActive && 'active'
    )

    if (isExpandable) {
      return (
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  className={triggerClass}
                >
                  <span className="flex-shrink-0 w-5 h-5">{icon}</span>
                  {badge !== undefined && badge > 0 ? (
                    <span className="sr-only">{badge} unread</span>
                  ) : null}
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {label}
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="w-64 p-2">
            <div className="px-2 py-1.5 text-sm font-semibold">{label}</div>
            <div className="space-y-1">
              {React.Children.map(children, (child) => {
                if (!React.isValidElement(child)) return child
                // `children` are expected to be `NavSubItem` elements; cast to allow adding the variant prop.
                return React.cloneElement(child, { variant: 'popover' })
              })}
            </div>
          </PopoverContent>
        </Popover>
      )
    }

    if (href) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={href} aria-label={label} className={triggerClass}>
              <span className="flex-shrink-0 w-5 h-5">{icon}</span>
              {badge !== undefined && badge > 0 ? (
                <span className="sr-only">{badge} unread</span>
              ) : null}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={label} className={triggerClass} onClick={handleClick}>
            <span className="flex-shrink-0 w-5 h-5">{icon}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
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
  variant?: 'sidebar' | 'popover'
}

export function NavSubItem({ label, href, badge, variant = 'sidebar' }: NavSubItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={cn(
        variant === 'sidebar' ? 'nav-item-nested' : 'flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent',
        isActive && 'active'
      )}
    >
      {variant === 'sidebar' && (
        <>
          {/* Horizontal connecting line from vertical bar */}
          <div className="absolute left-[22px] top-1/2 -translate-y-1/2 w-3 h-px bg-border" />
          <span className="ml-4 truncate">{label}</span>
        </>
      )}
      {variant === 'popover' && <span className="truncate">{label}</span>}
      {badge !== undefined && badge > 0 && (
        <Badge
          variant="secondary"
          className={cn(
            'ml-auto font-medium',
            variant === 'sidebar' ? 'h-4 min-w-4 px-1 text-[10px]' : 'h-5 min-w-5 px-1.5 text-xs'
          )}
        >
          {badge}
        </Badge>
      )}
    </Link>
  )
}

