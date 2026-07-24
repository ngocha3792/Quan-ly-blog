import { Injectable } from '@nestjs/common';

@Injectable()
export class ModeratorApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
