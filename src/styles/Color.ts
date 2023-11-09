// Should match tailwind.config.js
export enum Color {
  primaryBlack = '#010101',
  primaryWhite = '#FFFFFF',
  primaryGray = '#6B7280',
  lightGray = '#D0D4DB',
  primaryBlue = '#025AA1',
  primaryPink = '#D631B9',
  primaryBeige = '#F1EDE9',
  primaryRed = '#BF1B15',
  primaryMint = '#31D99C',
}

// Useful for cases when using class names isn't convenient
// such as in svg fills
export function classNameToColor(className) {
  switch (className) {
    case 'bg-blue-500':
      return Color.primaryBlue;
    case 'bg-red-500':
      return Color.primaryRed;
    case 'bg-gray-500':
      return Color.primaryGray;
    default:
      throw new Error('Missing color for className: ' + className);
  }
}
