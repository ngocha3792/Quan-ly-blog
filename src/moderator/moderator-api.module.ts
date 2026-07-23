import { Module } from '@nestjs/common';
import { ModeratorApiController } from './moderator-api.controller';
import { ModeratorApiService } from './moderator-api.service';

@Module({
  imports: [],
  controllers: [ModeratorApiController],
  providers: [ModeratorApiService],
})
export class ModeratorApiModule {}
