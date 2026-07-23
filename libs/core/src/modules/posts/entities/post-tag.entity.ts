import { PostTag } from '@prisma/client';

export class PostTagEntity implements PostTag {
    postId: number;
    tagId: number;

    constructor(partial: Partial<PostTagEntity>) {
        Object.assign(this, partial);
    }
}
