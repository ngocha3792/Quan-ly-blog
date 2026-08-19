import { Comment, type User } from '@prisma/client';
import { Exclude, Type } from 'class-transformer';

import { UserEntity } from '../../users/entities/user.entity';

type CommentUserSummary = Pick<
  User,
  'id' | 'username' | 'avatarUrl'
>;

export class CommentEntity implements Comment {
  id!: number;
  postId!: number;
  userId!: number;
  parentId!: number | null;
  content!: string;
  createdAt!: Date;
  updatedAt!: Date;

  /**
   * Không trả deletedAt ra frontend.
   */
  @Exclude()
  deletedAt!: Date | null;

  /**
   * Thông tin người viết bình luận.
   * Chỉ trả các trường public cần thiết.
   */
  @Type(() => UserEntity)
  user?: CommentUserSummary;

  /**
   * Các phản hồi cấp 2 của bình luận gốc.
   */
  @Type(() => CommentEntity)
  replies?: CommentEntity[];

  constructor(partial: Partial<CommentEntity>) {
    Object.assign(this, partial);

    if (partial.replies) {
      this.replies = partial.replies.map((reply) =>
        reply instanceof CommentEntity
          ? reply
          : new CommentEntity(reply),
      );
    }
  }
}

// import { Comment } from '@prisma/client';
// import { Type } from 'class-transformer';
// import { UserEntity } from '../../users/entities/user.entity';

// export class CommentEntity implements Comment {
//   id: number;
//   postId: number;
//   userId: number;
//   parentId: number | null;
//   content: string;
//   createdAt: Date;
//   updatedAt: Date;
//   deletedAt: Date | null;

//   @Type(() => UserEntity)
//   user?: UserEntity;

//   constructor(partial: Partial<CommentEntity>) {
//     Object.assign(this, partial);
//   }
// }
