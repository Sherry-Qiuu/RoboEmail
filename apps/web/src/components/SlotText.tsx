type Props = {
  text: string
  values: Record<string, string>
}

const SLOT = /\{\{([a-zA-Z0-9_]+)\}\}/g

/** Replaces filled slots and leaves the rest as [key], so the copied text is stable. */
export function fillSlots(text: string, values: Record<string, string>): string {
  return text.replace(SLOT, (_match, key: string) => values[key]?.trim() || `[${key}]`)
}

export function SlotText({ text, values }: Props) {
  const parts = text.split(/(\{\{[a-zA-Z0-9_]+\}\})/g)

  return (
    <>
      {parts.map((part, index) => {
        const match = /^\{\{([a-zA-Z0-9_]+)\}\}$/.exec(part)
        if (!match) return <span key={index}>{part}</span>

        const key = match[1] ?? ''
        const value = values[key]?.trim()
        return (
          <span
            key={index}
            className={
              value
                ? 'rounded-[2px] bg-accent-soft px-1 text-accent'
                : 'rounded-[2px] bg-warn-soft px-1 text-warn'
            }
          >
            {value || `[${key}]`}
          </span>
        )
      })}
    </>
  )
}
