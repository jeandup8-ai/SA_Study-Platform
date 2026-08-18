import { useEffect, useState } from 'react'

/**
 * Animates base-10 blocks growing in to represent hundreds / tens / units,
 * demonstrating place value for a given number (e.g. multiplication with carrying).
 */
export function PlaceValueAnimation({ value = 234 }: { value?: number }) {
  const hundreds = Math.floor(value / 100)
  const tens = Math.floor((value % 100) / 10)
  const units = value % 10
  const [visible, setVisible] = useState(0)
  const total = hundreds + tens + units

  useEffect(() => {
    setVisible(0)
    const id = setInterval(() => {
      setVisible((v) => (v < total ? v + 1 : v))
    }, 120)
    return () => clearInterval(id)
  }, [total])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-end gap-4">
        <BlockGroup label="Hundreds" count={hundreds} size={44} color="var(--color-brand-500)" visible={visible} startIndex={0} />
        <BlockGroup
          label="Tens"
          count={tens}
          size={16}
          height={44}
          color="var(--color-sun-500)"
          visible={visible}
          startIndex={hundreds}
        />
        <BlockGroup
          label="Units"
          count={units}
          size={14}
          color="var(--color-coral-400)"
          visible={visible}
          startIndex={hundreds + tens}
        />
      </div>
      <p className="text-2xl font-extrabold text-slate-800">{value}</p>
    </div>
  )
}

function BlockGroup({
  label,
  count,
  size,
  height,
  color,
  visible,
  startIndex,
}: {
  label: string
  count: number
  size: number
  height?: number
  color: string
  visible: number
  startIndex: number
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-end gap-1" style={{ width: size * 3 + 8 }}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={visible > startIndex + i ? 'animate-grow-up' : 'opacity-0'}
            style={{
              width: size,
              height: height ?? size,
              background: color,
              borderRadius: 4,
            }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
    </div>
  )
}
