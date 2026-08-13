import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  DefaultLanguageCannotBeDeletedException,
  DefaultLanguageCannotBeDeactivatedException,
  DefaultLanguageCannotBeUnsetException,
  DefaultLanguageConflictException,
  DefaultLanguageMustBeActiveException,
  LanguageAlreadyExistsException,
  LanguagesService,
  PrismaService,
} from '@app/core';

import { AdminLanguageEntity } from '../entities';
import {
  CreateAdminLanguageDto,
  UpdateAdminLanguageDto,
} from '../dto';

@Injectable()
export class AdminLanguagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly languagesService: LanguagesService,
  ) {}

  /**
   * Tạo language.
   *
   * Rule:
   * - Nếu chưa có default thì language đầu tiên tự thành default.
   * - Default luôn phải active.
   * - Nếu tạo default mới thì unset default cũ trong cùng transaction.
   */
  async createLanguage(
    dto: CreateAdminLanguageDto,
  ): Promise<AdminLanguageEntity> {
    try {
      const language = await this.prisma.$transaction(
        async (tx) => {
          const currentDefault =
            await tx.language.findFirst({
              where: {
                isDefault: true,
                deletedAt: null,
              },
              select: {
                id: true,
              },
            });

          /**
           * Nếu DB chưa có default thì language mới
           * bắt buộc trở thành default.
           */
          const shouldBeDefault =
            dto.isDefault === true || !currentDefault;

          if (
            shouldBeDefault &&
            dto.isActive === false
          ) {
            throw new DefaultLanguageMustBeActiveException();
          }

          /**
           * Nếu chuẩn bị tạo default mới:
           * unset default hiện tại trước.
           *
           * Vì nằm cùng transaction nên bên ngoài sẽ không
           * quan sát được trạng thái "0 default" ở giữa.
           */
          if (shouldBeDefault) {
            await tx.language.updateMany({
              where: {
                isDefault: true,
                deletedAt: null,
              },
              data: {
                isDefault: false,
              },
            });
          }

          /**
           * Dùng biến typed CreateAdminLanguageDto
           * để giữ được isDefault/isActive khi truyền xuống
           * LanguagesService.
           */
          const createDto: CreateAdminLanguageDto = {
            ...dto,
            isDefault: shouldBeDefault,

            /**
             * Default luôn active.
             */
            ...(shouldBeDefault
              ? {
                  isActive: true,
                }
              : {}),
          };

          return this.languagesService.create(
            createDto,
            tx,
          );
        },
      );

      return new AdminLanguageEntity(language);
    } catch (error) {
      this.rethrowLanguageUniqueViolation(
        error,
        dto.code,
      );

      throw error;
    }
  }

  async findAllLanguages(): Promise<
    AdminLanguageEntity[]
  > {
    const languages =
      await this.languagesService.findAll();

    return languages.map(
      (language) =>
        new AdminLanguageEntity(language),
    );
  }

  async findOneLanguage(
    id: number,
  ): Promise<AdminLanguageEntity> {
    const language =
      await this.languagesService.findOne(id);

    return new AdminLanguageEntity(language);
  }

  /**
   * Update language.
   *
   * Muốn đổi default:
   *
   * PATCH /admin/languages/:newDefaultId
   *
   * {
   *   "isDefault": true
   * }
   *
   * Không unset default cũ trực tiếp.
   */
  async updateLanguage(
    id: number,
    dto: UpdateAdminLanguageDto,
  ): Promise<AdminLanguageEntity> {
    try {
      const updated =
        await this.prisma.$transaction(
          async (tx) => {
            const current =
              await this.languagesService.findOne(
                id,
                tx,
              );

            /**
             * Không được:
             *
             * default = true
             *          ↓
             * default = false
             *
             * vì có thể làm hệ thống không còn default.
             */
            if (
              current.isDefault &&
              dto.isDefault === false
            ) {
              throw new DefaultLanguageCannotBeUnsetException();
            }

            /**
             * Default luôn phải active.
             */
            if (
              current.isDefault &&
              dto.isActive === false
            ) {
              throw new DefaultLanguageCannotBeDeactivatedException();
            }

            const willBecomeDefault =
              dto.isDefault === true;

            /**
             * Trạng thái active sau update.
             *
             * Nếu request không gửi isActive thì dùng
             * trạng thái hiện tại.
             */
            const resultingIsActive =
              dto.isActive ?? current.isActive;

            /**
             * Ví dụ language đang inactive:
             *
             * {
             *   "isDefault": true
             * }
             *
             * => không cho phép.
             */
            if (
              willBecomeDefault &&
              !resultingIsActive
            ) {
              throw new DefaultLanguageMustBeActiveException();
            }

            /**
             * Nếu language này chuẩn bị thành default,
             * unset default cũ trong cùng transaction.
             */
            if (willBecomeDefault) {
              await tx.language.updateMany({
                where: {
                  id: {
                    not: id,
                  },
                  isDefault: true,
                  deletedAt: null,
                },
                data: {
                  isDefault: false,
                },
              });
            }

            return this.languagesService.update(
              id,
              dto,
              tx,
            );
          },
        );

      return new AdminLanguageEntity(updated);
    } catch (error) {
      this.rethrowLanguageUniqueViolation(
        error,
        dto.code,
      );

      throw error;
    }
  }

  /**
   * Soft delete language.
   *
   * Default language không được delete.
   * Admin phải chuyển default trước.
   */
  async deleteLanguage(
    id: number,
  ): Promise<AdminLanguageEntity> {
    const deleted =
      await this.prisma.$transaction(
        async (tx) => {
          const current =
            await this.languagesService.findOne(
              id,
              tx,
            );

          if (current.isDefault) {
            throw new DefaultLanguageCannotBeDeletedException();
          }

          return this.languagesService.remove(
            id,
            tx,
          );
        },
      );

    return new AdminLanguageEntity(deleted);
  }

  /**
   * Partial unique index ở DB là lớp bảo vệ cuối
   * cho concurrent request.
   *
   * Ví dụ:
   *
   * Request A -> set EN default
   * Request B -> set JA default
   *
   * Nếu conflict DB xảy ra thì không trả raw 500.
   */
  private rethrowLanguageUniqueViolation(
    error: unknown,
    code?: string,
  ): void {
    if (
      !(
        error instanceof
        Prisma.PrismaClientKnownRequestError
      ) ||
      error.code !== 'P2002'
    ) {
      return;
    }

    const target = error.meta?.target;

    const targetText = Array.isArray(target)
      ? target.join(',')
      : String(target ?? '');

    /**
     * Nếu conflict do language code.
     */
    if (
      targetText.includes('code') &&
      code
    ) {
      throw new LanguageAlreadyExistsException(
        code,
      );
    }

    /**
     * Còn lại ở flow này chủ yếu là conflict
     * unique default language.
     */
    throw new DefaultLanguageConflictException();
  }
}
