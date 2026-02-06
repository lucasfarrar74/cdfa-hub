import type { Buyer } from '../types';

// Colorblind-friendly palette with good contrast
export const BUYER_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
  '#A855F7', // purple-500
];

// Get a color for a buyer based on their index
export function getBuyerColor(buyerIndex: number): string {
  return BUYER_COLORS[buyerIndex % BUYER_COLORS.length];
}

// Auto-assign colors to buyers who don't have one
export function assignBuyerColors(buyers: Buyer[]): Buyer[] {
  const usedColors = new Set(buyers.filter(b => b.color).map(b => b.color));
  const availableColors = BUYER_COLORS.filter(c => !usedColors.has(c));
  let colorIndex = 0;

  return buyers.map(buyer => {
    if (buyer.color) return buyer;

    // Assign next available color, cycling if we run out
    const color = availableColors.length > 0
      ? availableColors[colorIndex % availableColors.length]
      : BUYER_COLORS[colorIndex % BUYER_COLORS.length];
    colorIndex++;

    return { ...buyer, color };
  });
}

// Get contrasting text color (black or white) based on background
export function getContrastTextColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Generate a lighter version of a color for backgrounds
export function getLighterColor(hexColor: string, factor: number = 0.85): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = Math.round(r + (255 - r) * factor);
  const newG = Math.round(g + (255 - g) * factor);
  const newB = Math.round(b + (255 - b) * factor);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Create a map of buyer ID to color for quick lookups
export function createBuyerColorMap(buyers: Buyer[]): Map<string, string> {
  const map = new Map<string, string>();
  buyers.forEach((buyer, index) => {
    map.set(buyer.id, buyer.color || getBuyerColor(index));
  });
  return map;
}
