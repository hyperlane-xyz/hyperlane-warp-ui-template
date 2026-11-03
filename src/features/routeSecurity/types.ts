export type RouteSecurityValidationResult =
  | { valid: true }
  | { valid: false; reason: string; warpRouteId?: string };

export type RouteSecurityValidationFailure = Extract<
  RouteSecurityValidationResult,
  { valid: false }
>;
