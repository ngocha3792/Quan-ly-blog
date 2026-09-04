export interface ResponseFormat<T> {
  success: boolean;
  statusCode: number;
  // Controller có thể không trả gì (vd: 204 No Content) — TransformInterceptor
  // gán null trong trường hợp đó thay vì undefined.
  data: T | null;
  timestamp: string;
}
