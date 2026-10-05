import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { UNAUTHORIZED_EVENT } from '@/lib/api/client'
import { authApi } from '@/lib/api/endpoints'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState({ status: 'loading', user: null })

  useEffect(() => {
    let alive = true
    authApi
      .me()
      .then(({ user }) => alive && setState({ status: 'signed-in', user }))
      .catch(() => alive && setState({ status: 'signed-out', user: null }))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      setState({ status: 'signed-out', user: null })
      queryClient.clear()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [queryClient])

  const login = useCallback(async (email, password) => {
    const { user } = await authApi.login(email, password)
    setState({ status: 'signed-in', user })
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      queryClient.clear()
      setState({ status: 'signed-out', user: null })
    }
  }, [queryClient])

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
