import { useEffect, useState } from 'react'

/**
 * Self-contained SVG/CSS demo animation — no video provider, no external asset.
 * Slices fill in one at a time to visually build numerator/denominator.
 */
export function FractionsAnimation({ numerator = 3, denominator = 4 }: { numerator?: number; denominator?: number }) {
  const [filled, setFilled] = useState(0)

  useEffect(() => {
    setFilled(0)
    const timers = Array.from({ length: numerator }, (_, i) =>
      setTimeout(() => setFilled((f) => f + 1), 400 * (i + 1)),
    )
    return () => timers.forEach(clearTimeout)
  }, [numerator, denominator])

  const radius = 80
  const center = 100
  const sliceAngle = (2 * Math.PI) / denominator

  const slices = Array.from({ length: denominator }, (_, i) => {
    const start = i * sliceAngle - Math.PI / 2
    const end = start + sliceAngle
    const x1 = center + radius * Math.cos(start)
    const y1 = center + radius * Math.sin(start)
    const x2 = center + radius * Math.cos(end)
    const y2 = center + radius * Math.sin(end)
    const path = `M${center},${center} L${x1},${y1} A${radius},${radius} 0 0,1 ${x2},${y2} Z`
    return { path, isFilled: i < filled }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 200 200" className="h-48 w-48">
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.isFilled ? 'var(--color-brand-500)' : 'var(--color-brand-50)'}
            stroke="#fff"
            strokeWidth={2}
            className={s.isFilled ? 'animate-fill-slice' : ''}
          />
        ))}
      </svg>
      <p className="text-2xl font-extrabold text-brand-700">
        {numerator}/{denominator}
      </p>
    </div>
  )
}
