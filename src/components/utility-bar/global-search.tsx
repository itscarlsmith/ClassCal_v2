'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Command as CommandPrimitive } from 'cmdk'
import { SearchIcon } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { searchGlobal } from './search-adapter'
import type { SearchResult, SearchResultType } from './search-adapter'

interface GlobalSearchProps {
  role: 'teacher' | 'student'
}

const groupLabels: Record<SearchResultType, string> = {
  student: 'Students',
  teacher: 'Teachers',
  lesson: 'Lessons',
  homework: 'Homework',
  message: 'Messages',
  material: 'Materials',
  credit: 'Credits',
}

export function GlobalSearch({ role }: GlobalSearchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const latestQueryRef = useRef(query)

  useEffect(() => {
    latestQueryRef.current = query
  }, [query])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    let cancelled = false

    const runSearch = async () => {
      const trimmed = query.trim()
      if (!trimmed) {
        setResults([])
        return
      }

      const response = await searchGlobal({ role, query: trimmed })
      if (cancelled) return
      if (latestQueryRef.current.trim() !== trimmed) return
      setResults(response)
    }

    runSearch()

    return () => {
      cancelled = true
    }
  }, [query, role])

  const groupedResults = useMemo(() => {
    const groups = new Map<SearchResultType, SearchResult[]>()
    results.forEach((result) => {
      const list = groups.get(result.type) ?? []
      list.push(result)
      groups.set(result.type, list)
    })
    return groups
  }, [results])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    if (result.href) {
      router.push(result.href)
    }
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      event.currentTarget.blur()
    }
  }

  return (
    <div className="flex-1 px-6 max-w-[720px]">
      <Command className="w-full bg-transparent" shouldFilter={false}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-2 rounded-full border border-input bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring',
                open && 'ring-2 ring-ring'
              )}
            >
              <SearchIcon className="h-4 w-4 text-muted-foreground" />
              <CommandPrimitive.Input
                value={query}
                onValueChange={setQuery}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search students, lessons, homework..."
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                aria-label="Global search"
                aria-expanded={open}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent align="center" sideOffset={8} className="w-[min(720px,calc(100vw-2rem))] p-0">
            <CommandList>
              {query.trim().length === 0 && (
                <CommandEmpty>Start typing to search.</CommandEmpty>
              )}
              {query.trim().length > 0 && results.length === 0 && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}
              {Array.from(groupedResults.entries()).map(([type, items]) => (
                <CommandGroup key={type} heading={groupLabels[type]}>
                  {items.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={`${result.type}-${result.id}`}
                      onSelect={() => handleSelect(result)}
                    >
                      <div className="flex flex-col">
                        <span>{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </PopoverContent>
        </Popover>
      </Command>
    </div>
  )
}
