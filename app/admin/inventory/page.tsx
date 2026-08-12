"use client"

import { useState, useEffect } from "react"
import { Edit2, Save, X, AlertCircle, Plus, Trash2, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import { fetchProducts, updateProduct, createProduct, deleteProduct, bulkDeleteProducts, fetchCategories } from "@/lib/api-client"

interface Category {
  id: string
  name: string
  parent_id: string | null
}

export default function InventoryPage() {
  // Data State
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter/Pagination State
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  
  // Form State
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category_id: "",
    description: "",
    base_price: 0,
    gold_price: 0,
    silver_price: 0,
    stock_quantity: 0,
    low_stock_threshold: 10,
    image_url: "",
    is_active: true,
    is_featured: false,
    unit: "Piece"
  })

  // Load initial data
  useEffect(() => {
    loadCategories()
  }, [])

  // Load products when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts()
    }, 500) // Debounce search
    return () => clearTimeout(timer)
  }, [page, statusFilter, categoryFilter, search])

  const loadCategories = async () => {
    try {
      const data = await fetchCategories(true)
      setCategories(data)
    } catch (err: any) {
      console.error('Failed to load categories', err)
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        limit: 10,
        sort: 'created_at',
      }
      
      if (statusFilter !== "all") params.stock_status = statusFilter
      if (categoryFilter !== "all") params.category_id = categoryFilter
      if (search) params.search = search
      
      const data = await fetchProducts(params)
      setProducts(data.products || [])
      
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages)
        setTotalCount(data.pagination.total)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setSelectedProduct(null)
    setFormData({
      sku: "",
      name: "",
      category_id: categories.length > 0 ? categories[0].id : "",
      description: "",
      base_price: 0,
      gold_price: 0,
      silver_price: 0,
      stock_quantity: 0,
      low_stock_threshold: 10,
      image_url: "",
      is_active: true,
      is_featured: false,
      unit: "Piece"
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (product: any) => {
    setSelectedProduct(product)
    setFormData({
      sku: product.sku,
      name: product.name,
      category_id: product.category_id || "",
      description: product.description || "",
      base_price: parseFloat(product.base_price),
      gold_price: product.gold_price ? parseFloat(product.gold_price) : 0,
      silver_price: product.silver_price ? parseFloat(product.silver_price) : 0,
      stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold || 10,
      image_url: product.image_url || "",
      is_active: product.is_active,
      is_featured: product.featured || false,
      unit: product.unit || "Piece"
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (selectedProduct) {
        await updateProduct(selectedProduct.id, {
          ...formData,
          gold_price: formData.gold_price || null,
          silver_price: formData.silver_price || null
        })
      } else {
        await createProduct({
          ...formData,
          gold_price: formData.gold_price || undefined,
          silver_price: formData.silver_price || undefined
        })
      }
      setIsModalOpen(false)
      loadProducts()
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProduct) return
    setSaving(true)
    try {
      await deleteProduct(selectedProduct.id)
      setIsDeleteModalOpen(false)
      loadProducts()
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return
    setSaving(true)
    try {
      await bulkDeleteProducts(selectedProducts)
      setIsBulkDeleteModalOpen(false)
      setSelectedProducts([])
      loadProducts()
    } catch (err: any) {
      alert(`Failed to delete products: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(products.map(p => p.id))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_stock": return "bg-green-100 text-green-800"
      case "low_stock": return "bg-yellow-100 text-yellow-800"
      case "out_of_stock": return "bg-red-100 text-red-800"
      default: return "bg-muted text-foreground"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Inventory Manager</h1>
          <p className="text-muted-foreground">Product catalog and stock management ({totalCount} items)</p>
          {selectedProducts.length > 0 && (
            <p className="text-sm text-primary font-medium mt-1">{selectedProducts.length} product(s) selected</p>
          )}
        </div>
        <div className="flex gap-2">
          {selectedProducts.length > 0 && (
            <button 
              onClick={() => setIsBulkDeleteModalOpen(true)} 
              className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 size={20} />
              Delete Selected ({selectedProducts.length})
            </button>
          )}
          <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
            <Plus size={20} />
            Add Product
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-card p-4 border border-border rounded-lg flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 input-field w-full"
            />
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto min-w-[150px]"
          >
            <option value="all">All Status</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-field w-auto min-w-[150px]"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={products.length > 0 && selectedProducts.length === products.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prices (Base/Gold/Silver)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center">Loading...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No products found</td></tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-muted rounded-lg flex items-center justify-center">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="h-10 w-10 object-cover rounded-lg" />
                        ) : (
                          <span className="text-muted-foreground/70 text-xs">No Img</span>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-foreground">{product.name}</div>
                        {product.categories && (
                          <div className="text-xs text-muted-foreground">{product.categories.name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground font-mono">
                    {product.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">{product.stock_quantity}</div>
                    <div className="text-xs text-muted-foreground">Threshold: {product.low_stock_threshold}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium">${parseFloat(product.base_price).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">
                      G: {product.gold_price ? `$${parseFloat(product.gold_price).toFixed(2)}` : '-'} / 
                      S: {product.silver_price ? `$${parseFloat(product.silver_price).toFixed(2)}` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(product.stock_status)}`}>
                      {product.stock_status?.replace(/_/g, " ")}
                    </span>
                    {!product.is_active && (
                      <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-muted text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleOpenEdit(product)}
                      className="text-primary hover:text-primary/80 mr-4"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedProduct(product)
                        setIsDeleteModalOpen(true)
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className="bg-card px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary text-sm"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-foreground">
                Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold">{selectedProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-muted-foreground/70 hover:text-foreground" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    className="input-field w-full"
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Category *</label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                    className="input-field w-full"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Unit *</label>
                    <select
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="input-field w-full"
                    >
                      <optgroup label="Count/Quantity">
                        <option value="Piece">Piece</option>
                        <option value="Pair">Pair</option>
                        <option value="Dozen">Dozen</option>
                        <option value="Set">Set</option>
                        <option value="Pack">Pack</option>
                        <option value="Bundle">Bundle</option>
                      </optgroup>
                      <optgroup label="Weight">
                        <option value="g">Gram (g)</option>
                        <option value="kg">Kilogram (kg)</option>
                        <option value="lb">Pound (lb)</option>
                        <option value="oz">Ounce (oz)</option>
                        <option value="ton">Ton</option>
                      </optgroup>
                      <optgroup label="Volume">
                        <option value="ml">Milliliter (ml)</option>
                        <option value="L">Liter (L)</option>
                        <option value="gal">Gallon (gal)</option>
                        <option value="fl oz">Fluid Ounce (fl oz)</option>
                      </optgroup>
                      <optgroup label="Length">
                        <option value="cm">Centimeter (cm)</option>
                        <option value="m">Meter (m)</option>
                        <option value="in">Inch (in)</option>
                        <option value="ft">Foot (ft)</option>
                        <option value="yd">Yard (yd)</option>
                      </optgroup>
                      <optgroup label="Area">
                        <option value="sq m">Square Meter (sq m)</option>
                        <option value="sq ft">Square Foot (sq ft)</option>
                      </optgroup>
                      <optgroup label="Packaging">
                        <option value="Box">Box</option>
                        <option value="Case">Case</option>
                        <option value="Carton">Carton</option>
                        <option value="Bag">Bag</option>
                        <option value="Bottle">Bottle</option>
                        <option value="Can">Can</option>
                        <option value="Jar">Jar</option>
                        <option value="Container">Container</option>
                        <option value="Pallet">Pallet</option>
                        <option value="Roll">Roll</option>
                        <option value="Tube">Tube</option>
                      </optgroup>
                    </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="input-field w-full"
                ></textarea>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Base Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.base_price || ''}
                    onChange={(e) => setFormData({...formData, base_price: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Gold Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.gold_price || ''}
                    onChange={(e) => setFormData({...formData, gold_price: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                    className="input-field w-full"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Silver Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.silver_price || ''}
                    onChange={(e) => setFormData({...formData, silver_price: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                    className="input-field w-full"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity || ''}
                    onChange={(e) => setFormData({...formData, stock_quantity: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.low_stock_threshold || ''}
                    onChange={(e) => setFormData({...formData, low_stock_threshold: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Image URL</label>
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  className="input-field w-full"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm text-foreground">Active Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({...formData, is_featured: e.target.checked})}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm text-foreground">Featured Product</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Product</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete <span className="font-semibold text-foreground">{selectedProduct?.name}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn bg-red-600 text-white hover:bg-red-700"
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Multiple Products</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete <span className="font-semibold text-foreground">{selectedProducts.length} product(s)</span>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="btn bg-red-600 text-white hover:bg-red-700"
                disabled={saving}
              >
                {saving ? 'Deleting...' : `Delete ${selectedProducts.length} Product(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
