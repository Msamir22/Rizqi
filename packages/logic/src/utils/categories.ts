/**
 * Category detection utilities for Astik
 */

import { Category, CATEGORIES } from '../types';

export interface CategoryKeywords {
  [key: string]: string[];
}

export const CATEGORY_KEYWORDS: CategoryKeywords = {
  Food: [
    'restaurant',
    'cafe',
    'coffee',
    'breakfast',
    'lunch',
    'dinner',
    'pizza',
    'burger',
    'sandwich',
    'bakery',
    'food',
    'مطعم',
    'قهوة',
  ],
  Transport: [
    'fuel',
    'gas',
    'petrol',
    'uber',
    'careem',
    'taxi',
    'metro',
    'bus',
    'total',
    'shell',
    'مواصلات',
    'بنزين',
  ],
  Utilities: [
    'vodafone',
    'etisalat',
    'we',
    'orange',
    'top up',
    'bill payment',
    'electricity',
    'water',
    'internet',
    'mobile',
    'فاتورة',
  ],
  Shopping: [
    'amazon',
    'noon',
    'jumia',
    'mall',
    'store',
    'shop',
    'market',
    'carrefour',
    'spinneys',
    'تسوق',
    'سوبر ماركت',
  ],
  Entertainment: [
    'cinema',
    'netflix',
    'spotify',
    'youtube',
    'game',
    'movie',
    'theater',
    'سينما',
    'ترفيه',
  ],
  Health: ['pharmacy', 'doctor', 'hospital', 'clinic', 'medical', 'صيدلية', 'طبيب'],
  Education: ['school', 'university', 'course', 'book', 'training', 'مدرسة', 'كتاب'],
};

/**
 * Detect category from text (merchant name or description)
 * Returns category and confidence score (0-1)
 */
export function detectCategory(text: string): {
  category: string | null;
  confidence: number;
} {
  if (!text || text.trim().length === 0) {
    return { category: null, confidence: 0 };
  }

  const lowerText = text.toLowerCase();

  // Check each category for keyword matches
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        // Calculate confidence based on keyword length and text length
        const confidence = Math.min(0.95, (keyword.length / text.length) * 2);
        return { category, confidence };
      }
    }
  }

  // No match found
  return { category: null, confidence: 0 };
}

/**
 * Get all available categories
 */
export function getAllCategories(): readonly Category[] {
  return CATEGORIES;
}

/**
 * Validate category string
 */
export function isValidCategory(category: string): category is Category {
  return CATEGORIES.includes(category as Category);
}
