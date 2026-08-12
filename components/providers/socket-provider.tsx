'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

type UserPresence = {
  userId: string
  status: 'online' | 'offline'
}

type SocketContextType = {
  socket: Socket | null
  isConnected: boolean
  onlineUsers: Set<string>
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
})

export const useSocket = () => useContext(SocketContext)

/** Which class of device this tab is on, for notification routing. */
function detectDeviceClass(): 'desktop' | 'mobile' {
  if (typeof navigator === 'undefined') return 'desktop'
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ? 'mobile'
    : 'desktop'
}

// How long after the last real interaction this tab still counts as present.
const INTERACTION_WINDOW_MS = 5 * 60 * 1000
const PING_INTERVAL_MS = 45 * 1000

export function SocketProvider({ 
  children, 
  currentUserId 
}: { 
  children: React.ReactNode
  currentUserId?: string 
}) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!currentUserId) return

    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      path: '/api/socket.io',
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    setSocket(socketInstance)

    socketInstance.on('connect', () => {
      console.log('[SocketProvider] Connected with ID:', socketInstance.id)
      setIsConnected(true)
      socketInstance.emit('user:online', currentUserId)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('[SocketProvider] Connection error:', error.message)
      setIsConnected(false)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[SocketProvider] Disconnected:', reason)
      setIsConnected(false)
    })

    socketInstance.on('user:presence', (data: UserPresence) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev)
        if (data.status === 'online') {
          newSet.add(data.userId)
        } else {
          newSet.delete(data.userId)
        }
        return newSet
      })
    })

    return () => {
      socketInstance.disconnect()
    }
  }, [currentUserId])

  /**
   * Presence heartbeat driving the "hold mobile push while active on a computer"
   * rule.
   *
   * Deliberately reports *presence*, not merely that a tab exists: a laptop left
   * open overnight keeps firing timers, and a naive heartbeat would make the
   * user look permanently active and suppress their phone notifications forever.
   * So a ping is sent only while the tab is visible and has been interacted with
   * recently. Once pings lapse, the server stops counting this device.
   */
  useEffect(() => {
    if (!socket || !currentUserId) return

    const deviceClass = detectDeviceClass()
    let lastInteractionAt = Date.now()

    const markInteraction = () => { lastInteractionAt = Date.now() }
    const interactionEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus']
    interactionEvents.forEach(e =>
      window.addEventListener(e, markInteraction, { passive: true }))

    const announce = () => socket.emit('presence:hello', { userId: currentUserId, deviceClass })
    if (socket.connected) announce()
    socket.on('connect', announce)

    const ping = () => socket.emit('presence:ping', { userId: currentUserId, deviceClass })

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastInteractionAt > INTERACTION_WINDOW_MS) return
      ping()
    }, PING_INTERVAL_MS)

    // Coming back to the tab is itself an interaction worth reporting at once.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        markInteraction()
        ping()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      socket.off('connect', announce)
      document.removeEventListener('visibilitychange', handleVisibility)
      interactionEvents.forEach(e => window.removeEventListener(e, markInteraction))
    }
  }, [socket, currentUserId])

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  )
}
