import { NextRequest } from 'next/server'
import { createServerSupabaseClient, getCurrentUserProfile, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiValidationError, apiBadRequest } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const profile = await getCurrentUserProfile()

    if (!profile || !profile.brand_id) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }

    // Fetch product with category information — scoped to the caller's
    // own brand so one brand can never view another brand's catalog by ID.
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name,
          slug,
          description
        )
      `)
      .eq('id', id)
      .eq('brand_id', profile.brand_id)
      .single()

    if (error || !product) {
      return apiNotFound('Product not found')
    }

    // Get user's store tier for pricing
    let userTier: 'gold' | 'silver' | 'standard' = 'standard'
    if (profile.role === 'retailer') {
      const { data: store } = await supabase
        .from('stores')
        .select('tier')
        .eq('user_id', profile.id)
        .single()

      if (store) {
        userTier = store.tier
      }
    }
    
    // Add effective price for user's tier
    const productWithPricing = {
      ...product,
      effective_price: userTier === 'gold' 
        ? (product.gold_price || product.base_price)
        : userTier === 'silver'
        ? (product.silver_price || product.base_price)
        : product.base_price,
      user_tier: userTier
    }
    
    return apiSuccess(productWithPricing)
    
  } catch (error: any) {
    console.error('[PRODUCTS API] Error fetching product:', error)
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = await requireAdmin()
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    // Check the product exists AND belongs to the admin's own brand —
    // without the brand_id check here, any admin could edit any other
    // brand's product by ID.
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('brand_id', admin.brand_id)
      .single()

    if (fetchError || !existingProduct) {
      return apiNotFound('Product not found')
    }

    // Prepare update data
    const updateData: any = {}

    // If SKU is being updated, check for duplicates within the same brand
    // (SKUs aren't required to be globally unique across brands)
    if (body.sku && body.sku !== existingProduct.sku) {
      const { data: duplicateProduct } = await supabase
        .from('products')
        .select('id')
        .eq('sku', body.sku)
        .eq('brand_id', admin.brand_id)
        .neq('id', id)
        .single()

      if (duplicateProduct) {
        return apiValidationError([{
          field: 'sku',
          message: 'A product with this SKU already exists'
        }])
      }
      updateData.sku = body.sku
    }

    // Validate category belongs to the same brand — without this an
    // admin could reassign a product into another brand's category.
    if (body.category_id) {
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('id', body.category_id)
        .eq('brand_id', admin.brand_id)
        .single()

      if (!category) {
        return apiValidationError([{
          field: 'category_id',
          message: 'Category not found'
        }])
      }
      updateData.category_id = body.category_id
    }
    
    // Validate and add price fields
    if (body.base_price !== undefined) {
      if (body.base_price <= 0) {
        return apiValidationError([{
          field: 'base_price',
          message: 'Base price must be greater than 0'
        }])
      }
      updateData.base_price = body.base_price
    }
    
    if (body.gold_price !== undefined) {
      if (body.gold_price !== null && body.gold_price <= 0) {
        return apiValidationError([{
          field: 'gold_price',
          message: 'Gold price must be greater than 0 or null'
        }])
      }
      updateData.gold_price = body.gold_price
    }
    
    if (body.silver_price !== undefined) {
      if (body.silver_price !== null && body.silver_price <= 0) {
        return apiValidationError([{
          field: 'silver_price',
          message: 'Silver price must be greater than 0 or null'
        }])
      }
      updateData.silver_price = body.silver_price
    }
    
    // Update basic fields
    const basicFields = ['name', 'description', 'image_url', 'is_active', 'low_stock_threshold', 'unit']
    basicFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    if (body.is_featured !== undefined) {
      updateData.featured = body.is_featured
    }
    
    // Handle stock quantity update
    if (body.stock_quantity !== undefined) {
      if (body.stock_quantity < 0) {
        return apiValidationError([{
          field: 'stock_quantity',
          message: 'Stock quantity cannot be negative'
        }])
      }
      
      const lowThreshold = body.low_stock_threshold !== undefined 
        ? body.low_stock_threshold 
        : existingProduct.low_stock_threshold
      
      // Auto-determine stock status
      if (body.stock_quantity === 0) {
        updateData.stock_status = 'out_of_stock'
      } else if (body.stock_quantity <= lowThreshold) {
        updateData.stock_status = 'low_stock'
      } else {
        updateData.stock_status = 'in_stock'
      }
      
      updateData.stock_quantity = body.stock_quantity
      
      // Create inventory transaction for stock change
      if (body.stock_quantity !== existingProduct.stock_quantity) {
        const quantityChange = body.stock_quantity - existingProduct.stock_quantity
        await supabase
          .from('inventory_transactions')
          .insert({
            product_id: id,
            transaction_type: quantityChange > 0 ? 'restock' : 'adjustment',
            quantity_change: quantityChange,
            quantity_before: existingProduct.stock_quantity,
            quantity_after: body.stock_quantity,
            reference_type: 'manual',
            notes: body.stock_change_notes || 'Manual stock adjustment via API'
          })
      }
    }
    
    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return apiBadRequest('No valid fields to update')
    }
    
    // Update product
    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('brand_id', admin.brand_id)
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return apiSuccess({ product })
    
  } catch (error: any) {
    console.error('[PRODUCTS API] Error updating product:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to update product', 'UPDATE_ERROR', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = await requireAdmin()
    const supabase = await createServerSupabaseClient()

    // Check the product exists AND belongs to the admin's own brand.
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('brand_id', admin.brand_id)
      .single()

    if (fetchError || !existingProduct) {
      return apiNotFound('Product not found')
    }

    // Check for dependencies (optional, but good practice)
    // For example, check if product is in any active orders
    const { count: orderCount } = await supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id)

    if (orderCount && orderCount > 0) {
      return apiBadRequest('Cannot delete product because it has associated orders. Archive it instead.')
    }

    // Delete product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('brand_id', admin.brand_id)
    
    if (error) {
      throw error
    }
    
    return apiSuccess({ success: true })
    
  } catch (error: any) {
    console.error('[PRODUCTS API] Error deleting product:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to delete product', 'DELETE_ERROR', 500)
  }
}
