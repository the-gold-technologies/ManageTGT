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

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  )
}
