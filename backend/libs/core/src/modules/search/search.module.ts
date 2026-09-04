import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/core/core/prisma/prisma.module';
import { SearchIndexService } from './search-index.service';
import { SearchQueryService } from './search-query.service';
import { SearchReconciliationService } from './search-reconciliation.service';

@Module({
  imports: [PrismaModule],
  providers: [
    SearchIndexService,
    SearchQueryService,
    SearchReconciliationService,
  ],
  exports: [SearchIndexService, SearchQueryService],
})
export class SearchModule {}
