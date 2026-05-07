export interface Stock {
  id: string
  symbol: string
  name: string
  currentPrice: number
  currency: string
  priceSource?: string
  profileSource?: string
  brokeragePlatform?: string // e.g., "scalable-capital", "trade-republic"
  addedDate: string
}

export interface PortfolioItem {
  id: string
  stockId: string
  shares: number
  averageBuyPrice: number
  totalValue: number
}

export interface Portfolio {
  id: string
  userId: string
  items: PortfolioItem[]
  totalValue: number
  cash: number
}

export interface User {
  id: string
  email: string
  name?: string
  createdDate: string
}

export interface Notification {
  id: string
  userId: string
  stockId?: string
  message: string
  read: boolean
  createdDate: string
}
