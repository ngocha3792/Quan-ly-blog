/// <reference types="multer" />
import { Inject, Injectable } from '@nestjs/common';

import {
  v2 as cloudinary,
  type UploadApiResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';

import { CLOUDINARY } from './cloudinary.provider';

type CloudinaryResourceType = 'image' | 'video' | 'raw';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY)
    private readonly cloudinaryProvider: typeof cloudinary,
  ) {}

  /**
   * Upload ảnh hoặc video lên Cloudinary.
   */
  uploadFile(
    file: Express.Multer.File,
    folder = 'nestjs_blog',
  ): Promise<UploadApiResponse> {
    if (!file?.buffer) {
      return Promise.reject(
        new Error('File upload không hợp lệ'),
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream =
        this.cloudinaryProvider.uploader.upload_stream(
          {
            folder,
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            if (!result) {
              reject(
                new Error(
                  'Cloudinary không trả về kết quả upload',
                ),
              );
              return;
            }

            resolve(result);
          },
        );

      streamifier
        .createReadStream(file.buffer)
        .pipe(uploadStream);
    });
  }

  /**
   * Xóa file trên Cloudinary bằng publicId.
   */
  deleteFile(
    publicId: string,
    resourceType: CloudinaryResourceType = 'image',
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.cloudinaryProvider.uploader.destroy(
        publicId,
        {
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        },
      );
    });
  }
}