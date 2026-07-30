'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { SocketProvider } from './socket-provider'

export function SessionSocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  return (
    <SocketProvider currentUserId={session?.user?.id}>
      {children}
    </SocketProvider>
  )
}
