import { Injectable } from '@nestjs/common';
import { PrismaService, LanguagesService } from '@app/core';
import { AdminLanguageEntity } from '../entities';
import { CreateAdminLanguageDto, UpdateAdminLanguageDto } from '../dto';

@Injectable()
export class AdminLanguagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly languagesService: LanguagesService,
  ) {}

  /**
   * Thêm mới một ngôn ngữ (Tái sử dụng LanguagesService từ core).
   * Tự động đặt các ngôn ngữ khác isDefault = false nếu tạo ngôn ngữ mới làm mặc định.
   */
  async createLanguage(
    dto: CreateAdminLanguageDto,
  ): Promise<AdminLanguageEntity> {
    const language = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.language.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return this.languagesService.create(dto, tx);
    });

    return new AdminLanguageEntity(language);
  }

  /**
   * Lấy tất cả ngôn ngữ chưa bị xóa mềm (Tái sử dụng LanguagesService từ core).
   */
  async findAllLanguages(): Promise<AdminLanguageEntity[]> {
    const languages = await this.languagesService.findAll();
    return languages.map((lang) => new AdminLanguageEntity(lang));
  }

  /**
   * Lấy chi tiết 1 ngôn ngữ theo ID (Tái sử dụng LanguagesService từ core).
   */
  async findOneLanguage(id: number): Promise<AdminLanguageEntity> {
    const language = await this.languagesService.findOne(id);
    return new AdminLanguageEntity(language);
  }

  /**
   * Cập nhật thông tin ngôn ngữ (Tái sử dụng LanguagesService từ core).
   */
  async updateLanguage(
    id: number,
    dto: UpdateAdminLanguageDto,
  ): Promise<AdminLanguageEntity> {
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.language.updateMany({
          where: { id: { not: id }, isDefault: true },
          data: { isDefault: false },
        });
      }

      return this.languagesService.update(id, dto, tx);
    });

    return new AdminLanguageEntity(updated);
  }

  /**
   * Xóa mềm một ngôn ngữ (Tái sử dụng LanguagesService từ core).
   */
  async deleteLanguage(id: number): Promise<AdminLanguageEntity> {
    const deleted = await this.languagesService.remove(id);
    return new AdminLanguageEntity(deleted);
  }
}
