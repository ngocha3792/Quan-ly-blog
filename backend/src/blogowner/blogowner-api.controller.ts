import { Controller, Get } from '@nestjs/common';
import { BlogownerApiService } from './blogowner-api.service';

@Controller()
export class BlogownerApiController {
  constructor(private readonly blogownerApiService: BlogownerApiService) {}

  @Get()
  getHello(): string {
    return this.blogownerApiService.getHello();
  }
}
