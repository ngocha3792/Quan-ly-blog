import { Media, MediaType } from '@prisma/client';

export class MediaEntity implements Media {
    id: number;
    postId: number;
    mediaType: MediaType;
    mediaUrl: string;
    publicId: string;
    createdAt: Date;
    deletedAt: Date | null;

    constructor(partial: Partial<MediaEntity>) {
        Object.assign(this, partial);
    }
}
