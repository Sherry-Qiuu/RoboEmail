// The mark is a folded-corner sheet stamped with an R: the badge outline and the
// letter are one drawing, so the fill colors come from the theme tokens defined
// in styles.css (light: sage sheet, paper R; dark: paper sheet, ink R).
const BADGE =
  'M0 14C0 6.3 6.3 0 14 0H44L64 20V50C64 57.7 57.7 64 50 64H14C6.3 64 0 57.7 0 50Z'
const R =
  'M90 90H210V810H90ZM205 90H465L555 180V430H205ZM275 160V360H485V209L436 160ZM245 420H385L635 810H495Z'

type Props = {
  className?: string
}

export function BrandMark({ className }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d={BADGE} fill="var(--brand-mark-bg, #4f7a5b)" />
      <g transform="translate(16.625 11.5) scale(0.056944) translate(-90 -90)">
        <path d={R} fill="var(--brand-mark-fg, #f3f3f1)" fillRule="nonzero" />
      </g>
    </svg>
  )
}
