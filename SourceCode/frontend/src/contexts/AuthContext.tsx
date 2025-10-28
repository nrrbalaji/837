import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

interface Facility {
  facility_id: string
  facility_code: string
  facility_name: string
}

interface User {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  permissions: Record<string, string[]>
  assignedFacilities?: Facility[]
  isAdmin?: boolean
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing token and validate it
    const validateToken = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        try {
          // Validate token by fetching user data
          const response = await axios.get('/api/v1/auth/me')
          setUser(response.data.user)
        } catch (error) {
          console.error('Token validation failed:', error)
          // Clear invalid token
          localStorage.removeItem('token')
          delete axios.defaults.headers.common['Authorization']
        }
      }
      setLoading(false)
    }

    validateToken()
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/api/v1/auth/login', {
        username,
        password,
      })

      const { token, user } = response.data
      localStorage.setItem('token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(user)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
