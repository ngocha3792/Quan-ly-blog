import {
  Controller,
  Get,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Public } from '@app/core';
import { LanguagesPublicService } from '../services/languages-public.service';

@Controller('languages')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicLanguagesController {
  constructor(
    private readonly languagesPublicService: LanguagesPublicService,
  ) {}

  @Public()
  @Get()
  findAll() {
    return this.languagesPublicService.findAll();
  }
}
