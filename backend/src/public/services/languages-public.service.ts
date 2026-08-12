import { Injectable } from '@nestjs/common';
import { LanguagesService } from '@app/core';
import { PublicLanguageEntity } from '../entities';

@Injectable()
export class LanguagesPublicService {
  constructor(
    private readonly languagesService: LanguagesService,
  ) {}

  async findAll(): Promise<PublicLanguageEntity[]> {
    const languages = await this.languagesService.findAllActive();

    return languages.map(
      (language) => new PublicLanguageEntity(language),
    );
  }
}
