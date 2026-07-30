import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminLanguageDto } from './create-admin-language.dto';

export class UpdateAdminLanguageDto extends PartialType(
  CreateAdminLanguageDto,
) {}
