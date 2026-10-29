type Props = {
  onWrite: () => void
  onPolish: () => void
}

const CARDS = [
  { key: 'write', title: '写邮件' },
  { key: 'polish', title: '润色' },
]

export function HomePage({ onWrite, onPolish }: Props) {
  return (
    <section className="pt-8">
      <h1 className="font-display text-[38px] leading-none tracking-tight">RoboEmail</h1>

      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <button
            key={card.key}
            onClick={card.key === 'write' ? onWrite : onPolish}
            className="group border border-rule bg-surface px-7 py-10 text-left transition-colors hover:border-ink"
          >
            <span className="font-display text-[21px] tracking-tight">{card.title}</span>
            <span className="mt-6 block text-[12px] text-faint transition-colors group-hover:text-ink">
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
