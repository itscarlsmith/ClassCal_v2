'use client'

interface SectionLabelProps {
  label: string
}

export function SectionLabel({ label }: SectionLabelProps) {
  return (
    <div>
      <p className="text-base md:text-lg font-semibold text-foreground">{label}</p>
    </div>
  )
}
