'use client'

import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'

type Props = {
  value: number
  format?: (v: number) => string
  className?: string
}

export default function AnimatedNumber({ value, format, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    if (reduced) {
      el.textContent = format ? format(value) : String(value)
      return
    }
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format ? format(v) : String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [inView, value, format, reduced])

  return (
    <span ref={ref} className={className}>
      {format ? format(0) : '0'}
    </span>
  )
}
