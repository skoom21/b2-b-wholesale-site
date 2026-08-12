'use client'

import { createContext, useContext, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface Store {
  id: string
  name: string
  tier: 'gold' | 'silver' | 'standard'
  status: 'active' | 'pending' | 'inactive' | 'suspended'
  credit_limit: number
  credit_used: number
  credit_available: number
  contact_email?: string
  contact_phone?: string
  address?: string
  city?: string
  province?: string
  postal_code?: string
}

interface UserContextType {
  user: User | null
  store: Store | null
  isLoading: boolean
  refetchUser: () => void
  refetchStore: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const supabase = createClient()

function UserProviderInner({ children }: { children: ReactNode }) {
  // Fetch user
  const { data: user = null, isLoading: userLoading, refetch: refetchUser } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },
  })

  // Fetch store only if user exists
  const { data: store = null, isLoading: storeLoading, refetch: refetchStore } = useQuery({
    queryKey: ['store', user?.id],
    queryFn: async () => {
      if (!user) return null
      
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, tier, status, credit_limit, credit_used, email, phone, address_line1, city, province, postal_code')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      return {
        id: data.id,
        name: data.name,
        tier: data.tier,
        status: data.status,
        credit_limit: data.credit_limit,
        credit_used: data.credit_used,
        credit_available: data.credit_limit - data.credit_used,
        contact_email: data.email,
        contact_phone: data.phone,
        address: data.address_line1,
        city: data.city,
        province: data.province,
        postal_code: data.postal_code,
      } as Store
    },
    enabled: !!user,
  })

  const isLoading = userLoading || (user ? storeLoading : false)

  return (
    <UserContext.Provider value={{ user, store, isLoading, refetchUser, refetchStore }}>
      {children}
    </UserContext.Provider>
  )
}

export function UserProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProviderInner>{children}</UserProviderInner>
    </QueryClientProvider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
