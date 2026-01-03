import { useState, useEffect, useRef, useCallback } from 'react'

interface WebSocketMessage {
  type: 'update' | 'compacted' | 'ping'
  data?: {
    reason?: string
    changedFiles?: string[]
    timestamp?: string
  }
}

export function useWebSocket(onUpdate: () => void) {
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [recentChanges, setRecentChanges] = useState<string[]>([])
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const isUnmounting = useRef(false)
  
  const MAX_RECONNECT_ATTEMPTS = 5
  const BASE_RECONNECT_DELAY = 2000
  const INITIAL_CONNECTION_DELAY = 500
  const MAX_RECENT_CHANGES = 10

  const cleanupExistingConnection = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onclose = null
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close()
      }
      wsRef.current = null
    }
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      
      if (message.type === 'ping') return
      
      if (message.type === 'update' || message.type === 'compacted') {
        setLastUpdate(new Date())
        
        if (message.data?.changedFiles) {
          setRecentChanges(prev => 
            [...message.data!.changedFiles!, ...prev].slice(0, MAX_RECENT_CHANGES)
          )
        }
        
        onUpdate()
      }
    } catch (e) {
      console.warn('[Cartograph] Invalid WebSocket message:', e)
    }
  }, [onUpdate])

  const scheduleReconnect = useCallback(() => {
    if (isUnmounting.current || reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        console.log('[Cartograph] Max reconnection attempts reached')
      }
      return
    }

    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current)
    reconnectAttempts.current++
    console.log(`[Cartograph] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`)
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isUnmounting.current) {
        connect()
      }
    }, delay)
  }, [])

  const connect = useCallback(() => {
    if (isUnmounting.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    cleanupExistingConnection()

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const ws = new WebSocket(`${protocol}//${host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        if (isUnmounting.current) {
          ws.close()
          return
        }
        setConnected(true)
        reconnectAttempts.current = 0
        console.log('[Cartograph] WebSocket connected')
      }

      ws.onmessage = handleMessage

      ws.onclose = (event) => {
        setConnected(false)
        wsRef.current = null
        
        if (!isUnmounting.current && event.code !== 1000) {
          scheduleReconnect()
        }
      }

      ws.onerror = () => {
        console.warn('[Cartograph] WebSocket error')
      }
    } catch (e) {
      console.error('[Cartograph] Failed to create WebSocket:', e)
    }
  }, [cleanupExistingConnection, handleMessage, scheduleReconnect])

  useEffect(() => {
    isUnmounting.current = false
    
    const initTimeout = setTimeout(connect, INITIAL_CONNECTION_DELAY)

    return () => {
      isUnmounting.current = true
      clearTimeout(initTimeout)
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onclose = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
    }
  }, [connect])

  return { connected, lastUpdate, recentChanges }
}
