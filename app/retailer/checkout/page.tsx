"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Trash2, Loader2, ShoppingCart, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useUser } from "@/hooks/use-user"
import { createOrder, ApiError } from "@/lib/api-client"

interface CartItem {
  id: string
  name: string
  sku: string
  unit: string
  effective_price: number
  quantity: number
}

export default function CheckoutPage() {
  const router = useRouter()
  const { store, isLoading: userLoading } = useUser()
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerNotes, setCustomerNotes] = useState("")
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderNumber, setOrderNumber] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const savedCart = localStorage.getItem('cart')
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (e) {
        console.error('Failed to load cart:', e)
      }
    }
  }, [])

  const updateCart = (updatedCart: CartItem[]) => {
    setCart(updatedCart)
    localStorage.setItem('cart', JSON.stringify(updatedCart))
  }

  const removeItem = (productId: string) => {
    updateCart(cart.filter(item => item.id !== productId))
  }

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(productId)
      return
    }
    updateCart(cart.map(item =>
      item.id === productId ? { ...item, quantity: newQuantity } : item
    ))
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.effective_price * item.quantity), 0)
  }

  const calculateShipping = () => {
    const subtotal = calculateSubtotal()
    return subtotal >= 1000 ? 0 : 50
  }

  const calculateTax = () => {
    return (calculateSubtotal() + calculateShipping()) * 0.13
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping() + calculateTax()
  }

  const handlePlaceOrder = async () => {
    if (!store) {
      setError("No store found for your account")
      return
    }

    if (cart.length === 0) {
      setError("Your cart is empty")
      return
    }

    setIsPlacingOrder(true)
    setError(null)

    try {
      const orderData = {
        store_id: store.id,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.effective_price
        })),
        customer_notes: customerNotes || undefined,
        shipping_cost: calculateShipping(),
        tax_amount: calculateTax()
      }

      const response = await createOrder(orderData)
      setOrderNumber(response.order_number)
      setOrderPlaced(true)
      localStorage.removeItem('cart')

      setTimeout(() => {
        router.push("/retailer/orders")
      }, 3000)
    } catch (err) {
      console.error("Failed to place order:", err)
      setError(err instanceof ApiError ? err.message : "Failed to place order")
    } finally {
      setIsPlacingOrder(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
        <h2 className="text-xl font-bold text-secondary mb-2">No Store Found</h2>
        <p className="text-muted-foreground">You need a store to place orders.</p>
      </div>
    )
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-secondary mb-2">Order Placed Successfully!</h1>
          <p className="text-muted-foreground mb-6">
            Your order <span className="font-bold text-primary">#{orderNumber}</span> has been submitted for processing.
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to orders page...</p>
        </div>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="space-y-8">
        <Link href="/retailer/catalog" className="btn-ghost inline-flex items-center gap-2">
          <ArrowLeft size={18} />
          Back to Catalog
        </Link>

        <div className="card max-w-md mx-auto text-center py-12">
          <ShoppingCart className="mx-auto text-muted-foreground/70 mb-3" size={48} />
          <h2 className="text-xl font-bold text-secondary mb-2">Your Cart is Empty</h2>
          <p className="text-muted-foreground mb-6">Add some products from the catalog to get started.</p>
          <Link href="/retailer/catalog" className="btn-primary">
            Browse Catalog
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Link href="/retailer/catalog" className="btn-ghost inline-flex items-center gap-2">
        <ArrowLeft size={18} />
        Back to Catalog
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-secondary">Checkout</h1>
        <p className="text-muted-foreground mt-1">Review and confirm your order</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h2 className="text-xl font-bold text-secondary mb-6">Order Items</h2>

            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-start pb-4 border-b border-border last:border-0">
                  <div className="flex-1">
                    <p className="font-bold text-secondary">{item.name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                    <p className="text-sm text-muted-foreground mt-1">${item.effective_price.toFixed(2)} per {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="btn-ghost px-2 py-1 text-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="input w-16 text-center text-sm"
                        min="1"
                      />
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="btn-ghost px-2 py-1 text-sm"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="font-bold">${(item.effective_price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-secondary mb-4">Order Notes</h2>
            <textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Any special instructions or delivery notes..."
              className="input w-full resize-none h-24"
            />
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-xl font-bold text-secondary mb-6">Order Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">
                  {calculateShipping() === 0 ? "FREE" : `$${calculateShipping().toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (13%)</span>
                <span className="font-medium">${calculateTax().toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-border flex justify-between">
                <span className="font-bold text-secondary text-lg">Total</span>
                <span className="text-2xl font-bold text-primary">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {calculateSubtotal() >= 1000 && (
              <div className="mt-4 bg-green-50 border border-green-200 p-3 rounded-lg text-xs text-green-800">
                <p className="font-bold">🎉 Free shipping applied!</p>
              </div>
            )}

            {store?.tier && (
              <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-800">
                <p className="font-bold mb-1">{store.tier.charAt(0).toUpperCase() + store.tier.slice(1)} Tier Pricing</p>
                <p>Special pricing already applied to all items</p>
              </div>
            )}

            {store && (
              <div className="mt-4 p-3 bg-muted/50 border border-border rounded-lg text-xs">
                <p className="font-bold text-secondary mb-2">Credit Status</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credit Limit</span>
                    <span>${store.credit_limit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available</span>
                    <span className="font-medium text-green-600">
                      ${(store.credit_limit - store.credit_used).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder || cart.length === 0}
              className="btn-primary w-full mt-6 disabled:opacity-50"
            >
              {isPlacingOrder ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Placing Order...
                </>
              ) : (
                "Place Order"
              )}
            </button>

            <Link href="/retailer/catalog" className="btn-secondary w-full block text-center">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
