import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  NotContains,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class PageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
export class SearchQuery extends PageQuery {
  @Transform(trim) @IsString() @MaxLength(100) @NotContains('\u0000') q = '';
}
export class ArticleQuery extends SearchQuery {
  @ValidateIf((_object, value) => value !== undefined) @IsUUID() categoryId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['draft', 'pending', 'approved', 'rejected'])
  status?: string;
  @IsIn(['active', 'archived', 'all']) archive = 'active';
}
export class AuditQuery extends PageQuery {
  @ValidateIf((_object, value) => value !== undefined) @IsUUID() entityId?: string;
}
export class RevisionDto {
  @IsInt() @Min(1) @Max(2147483646) expectedRevision!: number;
}
export class CategoryDto {
  @Transform(trim) @IsString() @MaxLength(100) @Matches(/\S/u) @NotContains('\u0000') name!: string;
  @Transform(trim) @IsString() @MaxLength(500) @NotContains('\u0000') description = '';
}
export class UpdateCategoryDto extends CategoryDto {
  @IsInt() @Min(1) @Max(2147483646) expectedRevision!: number;
}
export class ArticleDto {
  @IsUUID() categoryId!: string;
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(/\S/u)
  @NotContains('\u0000')
  title!: string;
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  @Matches(/\S/u)
  @NotContains('\u0000')
  body!: string;
  @IsIn(['my', 'en']) language!: 'my' | 'en';
}
export class UpdateArticleDto extends ArticleDto {
  @IsInt() @Min(1) @Max(2147483646) expectedRevision!: number;
}
export class ReviewDto extends RevisionDto {
  @IsIn(['approve', 'reject']) decision!: 'approve' | 'reject';
  @Transform(trim) @IsString() @MaxLength(1000) @NotContains('\u0000') note = '';
}
