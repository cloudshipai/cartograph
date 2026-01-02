import { useState, useEffect, useCallback } from 'react'
import type { GraphData } from '../lib/types'

interface UseGraphDataResult {
  data: GraphData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useGraphData(): UseGraphDataResult {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/graph')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const graphData: GraphData = await response.json()
      setData(graphData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch graph')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
