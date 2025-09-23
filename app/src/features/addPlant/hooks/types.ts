export type StatusKind =
  | "image-processing"
  | "image-ready"
  | "identifying"
  | "policy-cache"
  | "policy-loading"
  | "policy-ready"
  | "confidence-low";

export interface UiStatus {
  kind: StatusKind;
  message: string;
}

export type ErrorKind = "image" | "identify" | "policy" | "manual";

export interface UiError {
  type: ErrorKind;
  message: string;
}
