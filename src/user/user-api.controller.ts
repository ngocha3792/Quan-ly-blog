import { Controller, Get } from '@nestjs/common';
import { UserApiService } from './user-api.service';

@Controller()
export class UserApiController {
  constructor(private readonly userApiService: UserApiService) {}

  @Get()
  getHello(): string {
    return this.userApiService.getHello();
  }
}
