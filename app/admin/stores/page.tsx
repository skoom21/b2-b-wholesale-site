"use client"

import { useState, useEffect } from "react"
import { Check, X, Clock, AlertCircle, Search, Filter, Mail, Phone, MapPin, Building2, TrendingUp, CreditCard } from "lucide-react"
import { fetchStores, updateStore as updateStoreAPI } from "@/lib/api-client"
import type { Store, StoreStatus } from "@/lib/types"

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [storeFilter, setStoreFilter] = useState<string>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    loadStores()
  }, [storeFilter])

  const loadStores = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = storeFilter !== "all" ? { status: storeFilter } : {}
      const data = await fetchStores(params)
      // fetchStores returns { stores: Store[], pagination: any }
      setStores(data.stores || [])
    } catch (err: any) {
      console.error('Failed to load stores:', err)
      setError(err.message || 'Failed to load stores. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (storeId: string, newStatus: StoreStatus) => {
    // Save previous state for rollback if needed
    const previousStores = [...stores]
    
    try {
      setUpdatingId(storeId)
      
      // Optimistic Update
      setStores(prev => prev.map(store => 
        store.id === storeId ? { ...store, status: newStatus } : store
      ))

      await updateStoreAPI(storeId, { status: newStatus })
      
      // Optional: Refresh from server to ensure data consistency
      // await loadStores() 
    } catch (err: any) {
      // Rollback on error
      setStores(previousStores)
      alert(`Failed to update store status: ${err.message || 'Unknown error'}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const getStatusIcon = (status: StoreStatus) => {
    switch (status) {
      case "active":
        return <Check className="text-emerald-600" size={16} />
      case "pending":
        return <Clock className="text-amber-600" size={16} />
      case "inactive":
        return <X className="text-rose-600" size={16} />
      case "suspended":
        return <AlertCircle className="text-rose-600" size={16} />
      default:
        return null
    }
  }

  const getStatusColorClass = (status: StoreStatus) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-100"
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-100"
      case "inactive":
      case "suspended":
        return "bg-rose-50 text-rose-700 border-rose-100"
      default:
        return "bg-muted/50 text-foreground border-border"
    }
  }

  if (loading && stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground font-medium animate-pulse">Loading stores...</p>
      </div>
    )
  }

  if (error && stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6">
        <div className="bg-rose-50 p-4 rounded-full">
          <AlertCircle className="text-rose-600" size={48} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-secondary mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button 
            onClick={() => loadStores()}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary tracking-tight">Store Management</h1>
          <p className="text-muted-foreground mt-1">Review retailer applications and manage existing store accounts</p>
        </div>
        
        <div className="flex flex-col space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filter Status</label>
          <div className="flex p-1 bg-muted rounded-lg">
            {["all", "pending", "active", "suspended"].map((status) => (
              <button
                key={status}
                onClick={() => setStoreFilter(status)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
                  storeFilter === status 
                    ? "bg-card text-primary shadow-sm ring-1 ring-black/5" 
                    : "text-muted-foreground hover:text-secondary hover:bg-muted/50"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border rounded-2xl p-12 text-center">
          <div className="bg-muted/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="text-muted-foreground/70" size={32} />
          </div>
          <h3 className="text-lg font-bold text-secondary mb-1">No stores found</h3>
          <p className="text-muted-foreground">No stores match your current filter criteria.</p>
          {storeFilter !== "all" && (
            <button 
              onClick={() => setStoreFilter("all")}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {stores.map((store) => (
            <div
              key={store.id}
              className={`group bg-card border rounded-2xl transition-all duration-300 hover:shadow-xl hover:border-primary/30 overflow-hidden ${
                selectedStore === store.id ? "ring-2 ring-primary border-transparent shadow-xl" : "border-border shadow-sm"
              }`}
            >
              {/* Header */}
              <div 
                className="p-6 cursor-pointer"
                onClick={() => setSelectedStore(selectedStore === store.id ? null : store.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <Building2 className="text-primary" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-secondary group-hover:text-primary transition-colors">{store.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium text-muted-foreground">{store.store_type?.replace('_', ' ')}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                        <span className="text-sm font-bold text-primary uppercase tracking-wider">{store.tier}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${getStatusColorClass(store.status)}`}>
                    {getStatusIcon(store.status)}
                    {store.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted/50 p-2 rounded-lg text-muted-foreground/70">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Location</p>
                      <p className="text-sm font-semibold text-secondary">{store.city}, {store.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-muted/50 p-2 rounded-lg text-muted-foreground/70">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Account Manager</p>
                      <p className="text-sm font-semibold text-secondary">{store.account_manager || 'Unassigned'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable Details */}
              <div 
                className={`transition-all duration-500 ease-in-out overflow-hidden ${
                  selectedStore === store.id ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-6 pb-6 pt-2 border-t border-border space-y-6">
                  {/* Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      <Mail className="text-muted-foreground/70" size={18} />
                      <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Email Address</p>
                        <p className="text-sm font-medium text-secondary truncate">{store.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      <Phone className="text-muted-foreground/70" size={18} />
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Phone Number</p>
                        <p className="text-sm font-medium text-secondary">{store.phone || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Credit Management */}
                  <div className="bg-secondary/5 border border-secondary/10 p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="text-secondary/60" size={18} />
                        <h4 className="font-bold text-secondary">Credit Utilization</h4>
                      </div>
                      <span className="text-xs font-bold text-secondary/60">
                        {Math.round(((store.credit_used || 0) / store.credit_limit) * 100)}% Used
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Used: <span className="font-bold text-secondary">${parseFloat(store.credit_used?.toString() || "0").toLocaleString()}</span></span>
                      <span className="text-muted-foreground">Limit: <span className="font-bold text-secondary">${parseFloat(store.credit_limit?.toString() || "0").toLocaleString()}</span></span>
                    </div>
                    
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          ((store.credit_used || 0) / store.credit_limit) > 0.9 ? 'bg-rose-500' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(((store.credit_used || 0) / store.credit_limit) * 100, 100)}%` }}
                      />
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-secondary/5 flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Available Credit</span>
                      <span className="text-lg font-black text-primary">
                        ${(parseFloat(store.credit_limit?.toString() || "0") - parseFloat(store.credit_used?.toString() || "0")).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    {store.status === "pending" && (
                      <>
                        <button 
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusUpdate(store.id, 'active')
                          }}
                          disabled={updatingId === store.id}
                        >
                          {updatingId === store.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              <span>Approving...</span>
                            </div>
                          ) : 'Approve Store'}
                        </button>
                        <button 
                          className="flex-1 bg-card border-2 border-rose-100 text-rose-600 hover:bg-rose-50 font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusUpdate(store.id, 'inactive')
                          }}
                          disabled={updatingId === store.id}
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {store.status === "active" && (
                      <button 
                        className="flex-1 bg-card border-2 border-rose-100 text-rose-600 hover:bg-rose-50 font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStatusUpdate(store.id, 'suspended')
                        }}
                        disabled={updatingId === store.id}
                      >
                        {updatingId === store.id ? 'Suspending...' : 'Suspend Account'}
                      </button>
                    )}

                    {store.status === "suspended" && (
                      <button 
                        className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStatusUpdate(store.id, 'active')
                        }}
                        disabled={updatingId === store.id}
                      >
                        {updatingId === store.id ? 'Reactivating...' : 'Reactivate Account'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

