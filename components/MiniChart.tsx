'use client'

export function MiniChart({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 120, h = 48
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  const lastX = w
  const lastY = h - ((data[data.length - 1] - min) / range) * h

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={color} />
    </svg>
  )
}
