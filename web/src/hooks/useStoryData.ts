import { useState, useEffect, useCallback } from 'react'
import type { ArchitectureStory } from '../lib/types'

export function useStoryData() {
  const [data, setData] = useState<ArchitectureStory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStory = useCallback(async () => {
    try {
      const response = await fetch('/api/story')
      if (!response.ok) throw new Error('Failed to fetch story')
      const story = await response.json()
      setData(story)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStory()
  }, [fetchStory])

  return { data, loading, error, refetch: fetchStory }
}
