import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/auth.guard';
import type { AuthRequest } from '../auth/auth.guard';
import { KnowledgeService } from './knowledge.service';
import {
  ArticleDto,
  ArticleQuery,
  AuditQuery,
  CategoryDto,
  PageQuery,
  ReviewDto,
  RevisionDto,
  SearchQuery,
  UpdateArticleDto,
  UpdateCategoryDto,
} from './knowledge.dto';
@Roles('admin', 'agent')
@Controller('knowledge-base')
export class KnowledgeController {
  constructor(@Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}
  @Get('categories') categories(@Req() req: AuthRequest, @Query() query: SearchQuery) {
    return this.knowledge.listCategories(req.user, query);
  }
  @Get('categories/:id') category(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledge.getCategory(req.user, id);
  }
  @Roles('admin') @Post('categories') createCategory(
    @Req() req: AuthRequest,
    @Body() body: CategoryDto,
  ) {
    return this.knowledge.createCategory(req.user, body);
  }
  @Roles('admin') @Patch('categories/:id') updateCategory(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.knowledge.updateCategory(req.user, id, body);
  }
  @Roles('admin') @Delete('categories/:id') @HttpCode(204) deleteCategory(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RevisionDto,
  ) {
    return this.knowledge.deleteCategory(req.user, id, body.expectedRevision);
  }
  @Get('articles') articles(@Req() req: AuthRequest, @Query() query: ArticleQuery) {
    return this.knowledge.listArticles(req.user, query);
  }
  @Get('articles/:id') article(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledge.getArticle(req.user, id);
  }
  @Post('articles') createArticle(@Req() req: AuthRequest, @Body() body: ArticleDto) {
    return this.knowledge.createArticle(req.user, body);
  }
  @Patch('articles/:id') updateArticle(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateArticleDto,
  ) {
    return this.knowledge.updateArticle(req.user, id, body);
  }
  @Roles('admin') @Delete('articles/:id') @HttpCode(204) archive(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RevisionDto,
  ) {
    return this.knowledge.archive(req.user, id, body.expectedRevision);
  }
  @Post('articles/:id/submit') @HttpCode(200) submit(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RevisionDto,
  ) {
    return this.knowledge.submit(req.user, id, body.expectedRevision);
  }
  @Roles('admin') @Post('articles/:id/review') @HttpCode(200) review(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewDto,
  ) {
    return this.knowledge.review(req.user, id, body);
  }
  @Get('articles/:id/versions') versions(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQuery,
  ) {
    return this.knowledge.versions(req.user, id, query);
  }
  @Roles('admin') @Get('audit-records') audit(@Req() req: AuthRequest, @Query() query: AuditQuery) {
    return this.knowledge.auditRecords(req.user, query);
  }
}
