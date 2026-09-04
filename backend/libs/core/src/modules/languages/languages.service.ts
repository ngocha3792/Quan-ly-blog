import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import {
  LanguageAlreadyExistsException,
  LanguageNotFoundException,
} from '@app/core/common/exceptions';
import { Prisma } from '@prisma/client';

@Injectable()
export class LanguagesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Chuyển language code (vd: 'vi', 'en') thành language ID.
   * Dùng chung cho tất cả public services thay vì duplicate ở mỗi service.
   */
  async getIdByCode(
    langCode: string | null,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<number | undefined> {
    if (!langCode) return undefined;
    const language = await prisma.language.findUnique({
      where: { code: langCode },
    });
    return language?.id;
  }

  /**
   * Resolve language code dành cho Public API.
   *
   * Chỉ trả về language khi:
   * - tồn tại
   * - đang active
   * - chưa bị soft delete
   *
   * Không thay thế getIdByCode() vì Admin/Core có thể
   * vẫn cần truy cập language inactive.
   */
  async getActiveIdByCode(
    langCode: string | null,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<number | undefined> {
    const normalizedCode = langCode?.trim().toLowerCase();

    if (!normalizedCode) {
      return undefined;
    }

    const language = await prisma.language.findFirst({
      where: {
        code: normalizedCode,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return language?.id;
  }

  /**
   * Lấy tất cả ngôn ngữ có thể sử dụng ở public.
   */
  async findAllActive(prisma: Prisma.TransactionClient = this.prisma) {
    return prisma.language.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  async create(
    createLanguageDto: CreateLanguageDto,
    prisma: Prisma.TransactionClient = this.prisma,
  ) {
    // Chuẩn hóa chữ thường: public API luôn lowercase code khi lọc theo
    // Accept-Language/?lang (xem getActiveIdByCode). Nếu code lưu không
    // lowercase, bài viết của ngôn ngữ đó sẽ không hiện với trình duyệt
    // thường (mọi request có Accept-Language sẽ bị lệch case, trả về rỗng).
    const normalizedCode = createLanguageDto.code.trim().toLowerCase();

    const existingCode = await prisma.language.findUnique({
      where: { code: normalizedCode },
    });

    if (existingCode) {
      throw new LanguageAlreadyExistsException(normalizedCode);
    }

    return prisma.language.create({
      data: { ...createLanguageDto, code: normalizedCode },
    });
  }

  async findAll(prisma: Prisma.TransactionClient = this.prisma) {
    return prisma.language.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, prisma: Prisma.TransactionClient = this.prisma) {
    const language = await prisma.language.findFirst({
      where: { id, deletedAt: null },
    });

    if (!language) {
      throw new LanguageNotFoundException(id.toString());
    }
    return language;
  }

  async update(
    id: number,
    updateLanguageDto: UpdateLanguageDto,
    prisma: Prisma.TransactionClient = this.prisma,
  ) {
    await this.findOne(id, prisma); // Kiểm tra tồn tại

    const data = { ...updateLanguageDto };

    if (data.code) {
      // Cùng lý do chuẩn hóa như create() — xem comment ở đó.
      data.code = data.code.trim().toLowerCase();

      const existingCode = await prisma.language.findUnique({
        where: { code: data.code },
      });
      if (existingCode && existingCode.id !== id) {
        throw new LanguageAlreadyExistsException(data.code);
      }
    }

    return prisma.language.update({
      where: { id },
      data,
    });
  }

  async remove(id: number, prisma: Prisma.TransactionClient = this.prisma) {
    await this.findOne(id, prisma); // Kiểm tra tồn tại

    // Soft delete
    return prisma.language.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number, prisma: Prisma.TransactionClient = this.prisma) {
    const language = await prisma.language.findUnique({
      where: { id },
    });
    if (!language) {
      throw new LanguageNotFoundException(id.toString());
    }

    return prisma.language.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
