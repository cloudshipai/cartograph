import { useState, useEffect, useRef, useCallback } from 'react'

interface WebSocketMessage {
  type: 'update'
  timestamp: string
  fileCount: number
}

export function useWebSocket(onUpdate: () => void) {
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data)
        if (msg.type === 'update') {
          setLastUpdate(new Date(msg.timestamp))
          onUpdate()
        }
      } catch {
        console.warn('Invalid WebSocket message:', event.data)
      }
    }

    wsRef.current = ws
  }, [onUpdate])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, lastUpdate }
}
