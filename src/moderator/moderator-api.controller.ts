import { Controller, Get } from '@nestjs/common';
import { ModeratorApiService } from './moderator-api.service';

@Controller()
export class ModeratorApiController {
  constructor(private readonly moderatorApiService: ModeratorApiService) {}

  @Get()
  getHello(): string {
    return this.moderatorApiService.getHello();
  }
}
