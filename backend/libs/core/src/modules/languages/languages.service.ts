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
    const existingCode = await prisma.language.findUnique({
      where: { code: createLanguageDto.code },
    });

    if (existingCode) {
      throw new LanguageAlreadyExistsException(createLanguageDto.code);
    }

    return prisma.language.create({
      data: createLanguageDto,
    });
  }

  async findAll(prisma: Prisma.TransactionClient = this.prisma) {
    return prisma.language.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    id: number,
    prisma: Prisma.TransactionClient = this.prisma,
  ) {
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

    if (updateLanguageDto.code) {
      const existingCode = await prisma.language.findUnique({
        where: { code: updateLanguageDto.code },
      });
      if (existingCode && existingCode.id !== id) {
        throw new LanguageAlreadyExistsException(updateLanguageDto.code);
      }
    }

    return prisma.language.update({
      where: { id },
      data: updateLanguageDto,
    });
  }

  async remove(
    id: number,
    prisma: Prisma.TransactionClient = this.prisma,
  ) {
    await this.findOne(id, prisma); // Kiểm tra tồn tại

    // Soft delete
    return prisma.language.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(
    id: number,
    prisma: Prisma.TransactionClient = this.prisma,
  ) {
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
