/**
 * Response handlers for AI Chat using Strategy Pattern
 *
 * Each handler has:
 * - keywords: Array of trigger words (multilingual)
 * - getResponse: Function that returns content and products
 */

import { mockProducts, mockCategories } from '../../services/mockData'
import type { Product } from '../../types'

type TFunction = (key: string, options?: Record<string, unknown>) => string

interface ResponseResult {
  content: string
  products?: Product[]
}

interface ResponseHandler {
  keywords: string[]
  getResponse: (t: TFunction, query: string) => ResponseResult | null
}

const handlers: ResponseHandler[] = [
  // Recommend / Popular
  {
    keywords: ['recomienda', 'popular', 'mejor', 'sugerir', 'recommend', 'best'],
    getResponse: (t) => ({
      content: t('ai.responses.recommend'),
      products: mockProducts.filter(p => p.popular).slice(0, 3),
    }),
  },

  // Vegan / Vegetarian
  {
    keywords: ['vegano', 'vegetariano', 'vegan', 'vegetarian'],
    getResponse: (t) => {
      const vegan = mockProducts.filter(
        p => p.badge === 'VEGAN' || p.name.toLowerCase().includes('veggie')
      )
      if (vegan.length > 0) {
        return { content: t('ai.responses.vegan'), products: vegan }
      }
      return { content: t('ai.responses.veganSingle') }
    },
  },

  // Cheap / Affordable
  {
    keywords: ['barato', 'economico', 'precio', 'cheap', 'affordable', 'price'],
    getResponse: (t) => ({
      content: t('ai.responses.cheap'),
      products: [...mockProducts].sort((a, b) => a.price - b.price).slice(0, 3),
    }),
  },

  // Premium / Expensive
  {
    keywords: ['caro', 'premium', 'especial', 'expensive'],
    getResponse: (t) => ({
      content: t('ai.responses.premium'),
      products: [...mockProducts].sort((a, b) => b.price - a.price).slice(0, 3),
    }),
  },

  // Drinks
  {
    keywords: ['bebida', 'tomar', 'beber', 'drink', 'beverage'],
    getResponse: (t) => ({
      content: t('ai.responses.drinks'),
      products: mockProducts.filter(p => p.category_id === '2'),
    }),
  },

  // Desserts
  {
    keywords: ['postre', 'dulce', 'chocolate', 'dessert', 'sweet', 'sobremesa'],
    getResponse: (t) => ({
      content: t('ai.responses.desserts'),
      products: mockProducts.filter(p => p.category_id === '3'),
    }),
  },

  // Food / Main dishes
  {
    keywords: ['comida', 'plato', 'comer', 'food', 'dish', 'eat'],
    getResponse: (t) => ({
      content: t('ai.responses.food'),
      products: mockProducts.filter(p => p.category_id === '1').slice(0, 4),
    }),
  },

  // Burger
  {
    keywords: ['burger', 'hamburguesa'],
    getResponse: (t) => {
      const burger = mockProducts.find(p => p.name.toLowerCase().includes('burger'))
      if (burger) {
        return { content: t('ai.responses.burger'), products: [burger] }
      }
      return null
    },
  },

  // Pasta
  {
    keywords: ['pasta', 'carbonara'],
    getResponse: (t) => {
      const pasta = mockProducts.find(
        p => p.name.toLowerCase().includes('pasta') || p.name.toLowerCase().includes('carbonara')
      )
      if (pasta) {
        return { content: t('ai.responses.pasta'), products: [pasta] }
      }
      return null
    },
  },

  // Salmon / Fish
  {
    keywords: ['salmon', 'pescado', 'fish', 'peixe'],
    getResponse: (t) => {
      const salmon = mockProducts.find(p => p.name.toLowerCase().includes('salmon'))
      if (salmon) {
        return { content: t('ai.responses.salmon'), products: [salmon] }
      }
      return null
    },
  },

  // Menu overview
  {
    keywords: ['menu', 'carta', 'tienen', 'cardápio'],
    getResponse: (t) => ({
      content: t('ai.responses.menu', {
        categories: mockCategories.length,
        categoryNames: mockCategories.map(c => c.name).join(', '),
        products: mockProducts.length,
      }),
    }),
  },

  // Greeting
  {
    keywords: ['hola', 'buenas', 'hey', 'hello', 'hi', 'olá', 'oi'],
    getResponse: (t) => ({
      content: t('ai.responses.greeting'),
    }),
  },
]

/**
 * Generate mock AI response based on user query
 * Uses strategy pattern to match query against handlers
 */
export function generateMockResponse(query: string, t: TFunction): ResponseResult {
  const lowerQuery = query.toLowerCase()

  // Find first matching handler
  for (const handler of handlers) {
    const matches = handler.keywords.some(keyword => lowerQuery.includes(keyword))
    if (matches) {
      const result = handler.getResponse(t, query)
      if (result) return result
    }
  }

  // Default response
  return {
    content: t('ai.responses.default'),
    products: mockProducts.slice(0, 3),
  }
}
