import { NextRequest, NextResponse } from 'next/server';

const BLOCKED_COUNTRIES = [
  'CU', // Cuba
  'KP', // North Korea
  'RU', // Russia
  'AF', // Afghanistan
  'BY', // Belarus
  'BA', // Bosnia & Herzegovina
  'CF', // Central African Republic
  'CD', // Democratic Republic of the Congo
  'GN', // Guinea
  'GW', // Guinea-Bissau
  'HT', // Haiti
  'IQ', // Iraq
  'LB', // Lebanon
  'LY', // Libya
  'ML', // Mali
  'NI', // Nicaragua
  'SO', // Somalia
  'SS', // South Sudan
  'SD', // Sudan
  'VE', // Venezuela
  'YE', // Yemen
  'ZW', // Zimbabwe
  'MM', // Myanmar
  'SY', // Syria
];

const BLOCKED_REGIONS = [
  [
    'UA',
    [
      '43', // Crimea
      '14', // Donetsk
      '09', // Luhansk
    ],
  ],
];

export function middleware(req: NextRequest) {
  console.log(req.geo?.country, req.geo?.region);

  const country = req.geo?.country || 'US';

  if (BLOCKED_COUNTRIES.includes(country)) {
    return NextResponse.redirect('/blocked');
  }

  return NextResponse.next();
}
