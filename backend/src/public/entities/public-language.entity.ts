export class PublicLanguageEntity {
  id: number;
  code: string;
  name: string;
  flag: string | null;
  isDefault: boolean;

  constructor(partial: Partial<PublicLanguageEntity>) {
    Object.assign(this, partial);
  }
}
