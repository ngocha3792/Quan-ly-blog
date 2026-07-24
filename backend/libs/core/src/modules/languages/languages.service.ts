import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { LanguageAlreadyExistsException, LanguageNotFoundException } from '@app/core/common/exceptions';

@Injectable()
export class LanguagesService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Chuyển language code (vd: 'vi', 'en') thành language ID.
   * Dùng chung cho tất cả public services thay vì duplicate ở mỗi service.
   */
  async getIdByCode(langCode: string | null): Promise<number | undefined> {
    if (!langCode) return undefined;
    const language = await this.prisma.language.findUnique({
      where: { code: langCode }
    });
    return language?.id;
  }

  async create(createLanguageDto: CreateLanguageDto) {
    const existingCode = await this.prisma.language.findUnique({
      where: { code: createLanguageDto.code },
    });

    if (existingCode) {
      throw new LanguageAlreadyExistsException(createLanguageDto.code);
    }

    return this.prisma.language.create({
      data: createLanguageDto,
    });
  }

  async findAll() {
    return this.prisma.language.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const language = await this.prisma.language.findFirst({
      where: { id, deletedAt: null },
    });

    if (!language) {
      throw new LanguageNotFoundException(id.toString());
    }
    return language;
  }

  async update(id: number, updateLanguageDto: UpdateLanguageDto) {
    await this.findOne(id); // Kiểm tra tồn tại

    if (updateLanguageDto.code) {
      const existingCode = await this.prisma.language.findUnique({
        where: { code: updateLanguageDto.code },
      });
      if (existingCode && existingCode.id !== id) {
        throw new LanguageAlreadyExistsException(updateLanguageDto.code);
      }
    }

    return this.prisma.language.update({
      where: { id },
      data: updateLanguageDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Kiểm tra tồn tại

    // Soft delete
    return this.prisma.language.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number) {
    const language = await this.prisma.language.findUnique({
      where: { id },
    });
    if (!language) {
      throw new LanguageNotFoundException(id.toString());
    }

    return this.prisma.language.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}

