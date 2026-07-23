export interface ResponseFormat<T> {
    success: boolean;
    statusCode: number;
    data: T;
    timestamp: string;
}
