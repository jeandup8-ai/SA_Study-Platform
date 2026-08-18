interface ProgressRingProps {
  value: number // 0-100
  size?: number
  strokeWidth?: number
  label?: string
}

function colorForValue(value: number): string {
  if (value >= 80) return '#16a34a' // success-600
  if (value >= 50) return '#f59e0b' // sun-500
  return '#f43f5e' // coral-500
}

export function ProgressRing({ value, size = 64, strokeWidth = 7, label }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorForValue(clamped)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-bold text-slate-700">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  )
}
