// Mục đích: Đọc page và limit từ URL Query (?page=2&limit=10),
//  sau đó quy đổi thành skip và take để tương thích trực tiếp với Prisma hoặc TypeORM.
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { PaginationParams } from "../interfaces";

export const Pagination = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): PaginationParams => {
        const request = ctx.switchToHttp().getRequest();

        // Lấy giá trị từ query, đảm bảo luôn là số nguyên dương >= 1
        const page = Math.max(1, parseInt(request.query.page as string, 10) || 1);
        const limit = Math.max(1, parseInt(request.query.limit as string, 10) || 10);

        // Giới hạn limit tối đa để tránh client request quá nhiều dữ liệu gây sập server
        const take = limit > 50 ? 50 : limit;
        const skip = (page - 1) * take;

        return { skip, take, page };
    },
);
