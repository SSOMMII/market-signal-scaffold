'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

type Market = 'kr' | 'us'

interface MarketContextType {
  market: Market
  toggle: () => void
}

const MarketContext = createContext<MarketContextType>({
  market: 'kr',
  toggle: () => {},
})

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<Market>('kr')
  const toggle = () => setMarket((m) => (m === 'kr' ? 'us' : 'kr'))
  return (
    <MarketContext.Provider value={{ market, toggle }}>
      {children}
    </MarketContext.Provider>
  )
}

export function useMarket() {
  return useContext(MarketContext)
}
