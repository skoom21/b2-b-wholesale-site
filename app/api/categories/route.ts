import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireBrandContext } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'

interface Category {
  id: string
  name: string
  description: string | null
  slug: string
  parent_id: string | null
  sort_order: number
  is_active: boolean
  children?: Category[]
}

function buildCategoryTree(flatCategories: any[]): Category[] {
  const categoryMap = new Map<string, Category>()
  const rootCategories: Category[] = []
  
  // First pass: create all category objects
  flatCategories.forEach(cat => {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      slug: cat.slug,
      parent_id: cat.parent_id,
      sort_order: cat.sort_order,
      is_active: cat.is_active,
      children: []
    })
  })
  
  // Second pass: build the tree structure
  categoryMap.forEach(category => {
    if (category.parent_id === null) {
      rootCategories.push(category)
    } else {
      const parent = categoryMap.get(category.parent_id)
      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(category)
      }
    }
  })
  
  // Sort children by sort_order
  const sortCategories = (categories: Category[]) => {
    categories.sort((a, b) => a.sort_order - b.sort_order)
    categories.forEach(cat => {
      if (cat.children && cat.children.length > 0) {
        sortCategories(cat.children)
      }
    })
  }
  
  sortCategories(rootCategories)
  
  return rootCategories
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireBrandContext()
    const supabase = await createServerSupabaseClient()
    const searchParams = request.nextUrl.searchParams
    const flat = searchParams.get('flat') === 'true'
    const activeOnly = searchParams.get('active_only') !== 'false' // Default to true

    // Build query
    let query = supabase
      .from('categories')
      .select('*')
      .eq('brand_id', profile.brand_id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('[CATEGORIES API] Error fetching categories:', error)
      return apiError('Failed to fetch categories', 'DATABASE_ERROR', 500, error)
    }
    
    // Return flat list or tree structure
    if (flat) {
      return apiSuccess(data)
    } else {
      const tree = buildCategoryTree(data || [])
      return apiSuccess(tree)
    }
    
  } catch (error: any) {
    console.error('[CATEGORIES API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
