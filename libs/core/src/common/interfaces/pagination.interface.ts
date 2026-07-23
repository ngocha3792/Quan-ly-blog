// Định nghĩa kiểu dữ liệu cho Meta data của phân trang
export interface PaginationMeta {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
}

// Định nghĩa form trả về chuẩn cho bất kỳ API danh sách nào
export interface PaginatedResult<T> {
    items: T[];
    meta: PaginationMeta;
}

// Tham số query đầu vào sau khi được decorator Pagination xử lý
export interface PaginationParams {
    skip: number;
    take: number;
    page: number;
}
