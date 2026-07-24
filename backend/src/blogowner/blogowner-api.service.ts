import { Injectable } from '@nestjs/common';

@Injectable()
export class BlogownerApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
