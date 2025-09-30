export type AddRouteStep = "photo" | "candidates" | "confirm";

export const ADD_ROUTE_STEPS: AddRouteStep[] = ["photo", "candidates", "confirm"];

export const DEFAULT_ADD_STEP: AddRouteStep = "photo";

export const isValidAddStep = (value: string | null): value is AddRouteStep =>
  Boolean(value && (ADD_ROUTE_STEPS as readonly string[]).includes(value));
