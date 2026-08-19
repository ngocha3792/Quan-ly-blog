import { IsBoolean, IsOptional } from 'class-validator';
import { CreateLanguageDto } from '@app/core';

export class CreateAdminLanguageDto extends CreateLanguageDto {
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái mặc định phải là boolean' })
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái kích hoạt phải là boolean' })
  isActive?: boolean;
}
