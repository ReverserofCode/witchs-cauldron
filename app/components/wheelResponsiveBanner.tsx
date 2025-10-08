'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface WheelResponsiveOptions {
  maxOffset?: number
  sensitivity?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function useWheelResponsiveOffset({
  maxOffset = 80,
  sensitivity = 0.25,
}: WheelResponsiveOptions = {}) {
  const [offset, setOffset] = useState(0)
  const targetOffsetRef = useRef(0)
  const frameRef = useRef<number | null>(null)

  const schedule = useCallback((nextOffset: number) => {
    targetOffsetRef.current = nextOffset
    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(() => {
        setOffset(targetOffsetRef.current)
        frameRef.current = null
      })
    }
  }, [])

  const applyWheelDelta = useCallback(
    (deltaY: number) => {
      const nextOffset = clamp(
        targetOffsetRef.current + deltaY * sensitivity,
        -maxOffset,
        maxOffset
      )
      schedule(nextOffset)
    },
    [maxOffset, sensitivity, schedule]
  )

  const setOffsetImmediate = useCallback(
    (value: number) => {
      const nextOffset = clamp(value, -maxOffset, maxOffset)
      schedule(nextOffset)
    },
    [maxOffset, schedule]
  )

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  return {
    offset,
    applyWheelDelta,
    setOffset: setOffsetImmediate,
  }
}
