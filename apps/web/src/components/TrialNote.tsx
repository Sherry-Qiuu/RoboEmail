type Props = {
  onRegister: () => void
}

export function TrialNote({ onRegister }: Props) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border border-rule px-5 py-4">
      <p className="text-[13px] text-muted">这次是试用，结果不会保存。</p>
      <button className="btn btn-ghost" onClick={onRegister}>
        注册
      </button>
    </div>
  )
}
