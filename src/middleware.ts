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
  {
    country: 'UA', // Ukraine
    regions: [
      '43', // Crimea
      '14', // Donetsk
      '09', // Luhansk
    ],
  },
];

export function middleware(req: NextRequest) {
  const country = req.geo?.country;
  const region = req.geo?.region;

  if (country && BLOCKED_COUNTRIES.includes(country)) {
    return NextResponse.redirect('/blocked');
  }

  if (
    country &&
    region &&
    BLOCKED_REGIONS.find((x) => x.country === country)?.regions.includes(region)
  ) {
    return NextResponse.redirect('/blocked');
  }

  return NextResponse.next();
}
