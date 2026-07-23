import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Đánh dấu @Global() để import 1 lần duy nhất ở AppModule
// Sau đó mọi Module khác (Auth, Users, Posts...) đều có thể xài PrismaService mà không cần import lại PrismaModule.
@Global()
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}
