"use client"

import { useState, useEffect } from "react"
import { Check, X, Clock, AlertCircle, Search, Mail, Phone, MapPin, Building2, TrendingUp, CreditCard, Inbox, Plus, Trash2, ShoppingBag, Repeat } from "lucide-react"
import { fetchStores, updateStore as updateStoreAPI, fetchCreditRequests, resolveCreditRequest, recordStorePayment, createManualOrder, fetchProducts, fetchPaymentModelRequests, resolvePaymentModelRequest, type CreditRequest, type PaymentModelRequest } from "@/lib/api-client"
import type { Store, StoreStatus } from "@/lib/types"

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [storeFilter, setStoreFilter] = useState<string>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([])
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null)

  const [paymentFormId, setPaymentFormId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  const [paymentNotes, setPaymentNotes] = useState<string>("")
  const [submittingPaymentId, setSubmittingPaymentId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const [products, setProducts] = useState<any[]>([])
  const [walkInFormId, setWalkInFormId] = useState<string | null>(null)
  const [walkInItems, setWalkInItems] = useState<{ product_id: string; quantity: string }[]>([{ product_id: "", quantity: "1" }])
  const [submittingWalkInId, setSubmittingWalkInId] = useState<string | null>(null)
  const [walkInError, setWalkInError] = useState<string | null>(null)

  const [modelRequests, setModelRequests] = useState<PaymentModelRequest[]>([])
  const [resolvingModelRequestId, setResolvingModelRequestId] = useState<string | null>(null)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [modelDraft, setModelDraft] = useState<{ payment_model: string; billing_frequency: string }>({ payment_model: "credit", billing_frequency: "weekly" })
  const [savingModelId, setSavingModelId] = useState<string | null>(null)

  useEffect(() => {
    loadStores()
  }, [storeFilter])

  useEffect(() => {
    loadModelRequests()
  }, [])

  useEffect(() => {
    loadCreditRequests()
    fetchProducts({ limit: 200 }).then((data: any) => setProducts(data.products || [])).catch(() => {})
  }, [])

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

  const loadCreditRequests = async () => {
    try {
      const data = await fetchCreditRequests()
      setCreditRequests((data.requests || []).filter(r => r.transaction_type === 'credit_request_pending'))
    } catch (err) {
      console.error('Failed to load credit requests:', err)
    }
  }

  const loadModelRequests = async () => {
    try {
      const data = await fetchPaymentModelRequests()
      setModelRequests((data.requests || []).filter(r => r.status === 'pending'))
    } catch (err) {
      console.error('Failed to load payment model requests:', err)
    }
  }

  const handleResolveModelRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setResolvingModelRequestId(requestId)
      await resolvePaymentModelRequest(requestId, action)
      const resolved = modelRequests.find(r => r.id === requestId)
      setModelRequests(prev => prev.filter(r => r.id !== requestId))
      if (action === 'approve' && resolved?.store_id) {
        setStores(prev => prev.map(s => s.id === resolved.store_id
          ? { ...s, payment_model: resolved.requested_model, billing_frequency: resolved.requested_billing_frequency } as any
          : s))
      }
    } catch (err: any) {
      alert(`Failed to resolve request: ${err.message || 'Unknown error'}`)
    } finally {
      setResolvingModelRequestId(null)
    }
  }

  const startEditingModel = (store: any) => {
    setEditingModelId(store.id)
    setModelDraft({ payment_model: store.payment_model || "credit", billing_frequency: store.billing_frequency || "weekly" })
  }

  const cancelEditingModel = () => {
    setEditingModelId(null)
  }

  const savePaymentModel = async (storeId: string) => {
    try {
      setSavingModelId(storeId)
      const payload: any = { payment_model: modelDraft.payment_model }
      if (modelDraft.payment_model === 'subscription') {
        payload.billing_frequency = modelDraft.billing_frequency
      }
      await updateStoreAPI(storeId, payload)
      setStores(prev => prev.map(s => s.id === storeId ? { ...s, ...payload } as any : s))
      setEditingModelId(null)
    } catch (err: any) {
      alert(`Failed to update payment model: ${err.message || 'Unknown error'}`)
    } finally {
      setSavingModelId(null)
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

  const startPaymentForm = (storeId: string) => {
    setPaymentFormId(storeId)
    setPaymentAmount("")
    setPaymentNotes("")
    setPaymentError(null)
  }

  const cancelPaymentForm = () => {
    setPaymentFormId(null)
    setPaymentError(null)
  }

  const handleRecordPayment = async (storeId: string) => {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      setPaymentError("Enter a valid amount")
      return
    }
    try {
      setSubmittingPaymentId(storeId)
      setPaymentError(null)
      const result = await recordStorePayment(storeId, { amount, notes: paymentNotes || undefined })
      setStores(prev => prev.map(s => s.id === storeId ? { ...s, credit_used: result.credit_used } : s))
      setPaymentFormId(null)
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment")
    } finally {
      setSubmittingPaymentId(null)
    }
  }

  const startWalkInForm = (storeId: string) => {
    setWalkInFormId(storeId)
    setWalkInItems([{ product_id: "", quantity: "1" }])
    setWalkInError(null)
  }

  const cancelWalkInForm = () => {
    setWalkInFormId(null)
    setWalkInError(null)
  }

  const updateWalkInItem = (index: number, field: "product_id" | "quantity", value: string) => {
    setWalkInItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const addWalkInRow = () => {
    setWalkInItems(prev => [...prev, { product_id: "", quantity: "1" }])
  }

  const removeWalkInRow = (index: number) => {
    setWalkInItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleCreateWalkInOrder = async (storeId: string) => {
    const items = walkInItems
      .filter(i => i.product_id && parseInt(i.quantity) > 0)
      .map(i => ({ product_id: i.product_id, quantity: parseInt(i.quantity) }))

    if (items.length === 0) {
      setWalkInError("Add at least one product")
      return
    }

    try {
      setSubmittingWalkInId(storeId)
      setWalkInError(null)
      await createManualOrder(storeId, { items })
      setWalkInFormId(null)
      await loadStores()
    } catch (err: any) {
      setWalkInError(err.message || "Failed to log order")
    } finally {
      setSubmittingWalkInId(null)
    }
  }

  const handleResolveRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setResolvingRequestId(requestId)
      await resolveCreditRequest(requestId, action)
      const resolved = creditRequests.find(r => r.id === requestId)
      setCreditRequests(prev => prev.filter(r => r.id !== requestId))
      if (action === 'approve' && resolved?.store_id) {
        setStores(prev => prev.map(s => s.id === resolved.store_id ? { ...s, credit_limit: resolved.balance_after } : s))
      }
    } catch (err: any) {
      alert(`Failed to resolve request: ${err.message || 'Unknown error'}`)
    } finally {
      setResolvingRequestId(null)
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

      {/* Pending Credit Requests */}
      {creditRequests.length > 0 && (
        <div className="card border-l-4 border-l-primary">
          <div className="flex items-center gap-2 mb-4">
            <Inbox className="text-primary" size={20} />
            <h2 className="text-xl font-bold text-secondary">Pending Credit Requests</h2>
            <span className="status-badge status-yellow">{creditRequests.length}</span>
          </div>
          <div className="space-y-3">
            {creditRequests.map((req) => (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/50 rounded-xl">
                <div>
                  <p className="font-semibold text-secondary">{req.stores?.name || 'Unknown store'}</p>
                  <p className="text-sm text-muted-foreground">
                    Requesting ${req.balance_after.toLocaleString()} (up from ${req.balance_before.toLocaleString()})
                  </p>
                  {req.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{req.notes}"</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleResolveRequest(req.id, 'approve')}
                    disabled={resolvingRequestId === req.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleResolveRequest(req.id, 'reject')}
                    disabled={resolvingRequestId === req.id}
                    className="bg-card border-2 border-rose-100 text-rose-600 hover:bg-rose-50 font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Payment Model Requests */}
      {modelRequests.length > 0 && (
        <div className="card border-l-4 border-l-primary">
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="text-primary" size={20} />
            <h2 className="text-xl font-bold text-secondary">Pending Payment Model Requests</h2>
            <span className="status-badge status-yellow">{modelRequests.length}</span>
          </div>
          <div className="space-y-3">
            {modelRequests.map((req) => (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/50 rounded-xl">
                <div>
                  <p className="font-semibold text-secondary">{req.stores?.name || 'Unknown store'}</p>
                  <p className="text-sm text-muted-foreground">
                    Wants to switch from <span className="font-medium">{req.current_model.replace('_', ' ')}</span> to{' '}
                    <span className="font-medium">{req.requested_model.replace('_', ' ')}</span>
                    {req.requested_billing_frequency && ` (${req.requested_billing_frequency})`}
                  </p>
                  {req.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{req.reason}"</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleResolveModelRequest(req.id, 'approve')}
                    disabled={resolvingModelRequestId === req.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleResolveModelRequest(req.id, 'reject')}
                    disabled={resolvingModelRequestId === req.id}
                    className="bg-card border-2 border-rose-100 text-rose-600 hover:bg-rose-50 font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <div className="flex flex-col gap-4">
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

                  {/* Payment Model */}
                  <div className="bg-secondary/5 border border-secondary/10 p-5 rounded-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 mb-4">
                      <Repeat className="text-secondary/60" size={18} />
                      <h4 className="font-bold text-secondary">Payment Model</h4>
                    </div>

                    {editingModelId === store.id ? (
                      <div className="space-y-2">
                        <select
                          value={modelDraft.payment_model}
                          onChange={(e) => setModelDraft({ ...modelDraft, payment_model: e.target.value })}
                          className="input w-full"
                        >
                          <option value="credit">Credit (net terms)</option>
                          <option value="per_order">Per Order (pay up front)</option>
                          <option value="subscription">Subscription (consolidated billing)</option>
                        </select>
                        {modelDraft.payment_model === 'subscription' && (
                          <select
                            value={modelDraft.billing_frequency}
                            onChange={(e) => setModelDraft({ ...modelDraft, billing_frequency: e.target.value })}
                            className="input w-full"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => savePaymentModel(store.id)}
                            disabled={savingModelId === store.id}
                            className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
                          >
                            {savingModelId === store.id ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={cancelEditingModel} className="btn-ghost px-3 py-2 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-secondary capitalize">
                            {((store as any).payment_model || 'credit').replace('_', ' ')}
                            {(store as any).billing_frequency && ` — ${(store as any).billing_frequency}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(store as any).payment_model === 'per_order'
                              ? 'Pays for each order up front'
                              : (store as any).payment_model === 'subscription'
                              ? 'Dues consolidated and billed on a schedule'
                              : 'Dues accumulate, paid down anytime (net terms)'}
                          </p>
                        </div>
                        <button
                          onClick={() => startEditingModel(store)}
                          className="text-sm font-semibold text-primary hover:underline shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dues / Amount Owed */}
                  <div className="bg-secondary/5 border border-secondary/10 p-5 rounded-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="text-secondary/60" size={18} />
                        <h4 className="font-bold text-secondary">Amount Owed</h4>
                      </div>
                      <span className="text-lg font-black text-primary">
                        ${parseFloat(store.credit_used?.toString() || "0").toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Builds up automatically as orders are confirmed. Record a payment whenever they pay you back — in-store cash, e-transfer, however they actually pay.
                    </p>

                    {paymentFormId === store.id ? (
                      <div className="space-y-2">
                        {paymentError && <p className="text-xs text-destructive">{paymentError}</p>}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">$</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Amount paid"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="input flex-1"
                            autoFocus
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Note (optional) — e.g. cash, e-transfer"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          className="input w-full"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRecordPayment(store.id)}
                            disabled={submittingPaymentId === store.id}
                            className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
                          >
                            {submittingPaymentId === store.id ? 'Saving...' : 'Save Payment'}
                          </button>
                          <button onClick={cancelPaymentForm} className="btn-ghost px-3 py-2 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startPaymentForm(store.id)}
                        className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        Record Payment
                      </button>
                    )}
                  </div>

                  {/* Walk-in / in-store order */}
                  <div className="bg-secondary/5 border border-secondary/10 p-5 rounded-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="text-secondary/60" size={18} />
                        <h4 className="font-bold text-secondary">Walk-in Order</h4>
                      </div>
                    </div>

                    {walkInFormId === store.id ? (
                      <div className="space-y-3">
                        {walkInError && <p className="text-xs text-destructive">{walkInError}</p>}
                        {walkInItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={item.product_id}
                              onChange={(e) => updateWalkInItem(idx, "product_id", e.target.value)}
                              className="input flex-1"
                            >
                              <option value="">Select product</option>
                              {products.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name} — ${p.base_price}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateWalkInItem(idx, "quantity", e.target.value)}
                              className="input w-20"
                            />
                            {walkInItems.length > 1 && (
                              <button onClick={() => removeWalkInRow(idx)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={addWalkInRow} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                          <Plus size={12} /> Add another product
                        </button>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleCreateWalkInOrder(store.id)}
                            disabled={submittingWalkInId === store.id}
                            className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
                          >
                            {submittingWalkInId === store.id ? 'Logging...' : 'Log Order'}
                          </button>
                          <button onClick={cancelWalkInForm} className="btn-ghost px-3 py-2 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startWalkInForm(store.id)}
                        className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        Log an order they placed in person
                      </button>
                    )}
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
