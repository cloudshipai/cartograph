import { useState, useEffect, useCallback } from 'react'
import type { DiagramSet } from '../lib/types'

export function useDiagrams() {
  const [data, setData] = useState<DiagramSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDiagrams = useCallback(async () => {
    try {
      const response = await fetch('/api/diagrams')
      if (!response.ok) throw new Error('Failed to fetch diagrams')
      const diagrams = await response.json()
      setData(diagrams)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDiagrams()
  }, [fetchDiagrams])

  return { data, loading, error, refetch: fetchDiagrams }
}
