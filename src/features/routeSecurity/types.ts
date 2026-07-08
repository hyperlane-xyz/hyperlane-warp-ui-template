export type RouteSecurityValidationResult =
  | { valid: true }
  | { valid: false; reason: string; warpRouteId?: string };
