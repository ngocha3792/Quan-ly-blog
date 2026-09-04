// import { Provider } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { v2 as cloudinary } from 'cloudinary';

// export const CLOUDINARY = 'Cloudinary';

// export const CloudinaryProvider: Provider = {
//   provide: CLOUDINARY,
//   useFactory: (configService: ConfigService) => {
//     return cloudinary.config({
//       cloud_name: configService.get<string>('cloudinary.cloudName'),
//       api_key: configService.get<string>('cloudinary.apiKey'),
//       api_secret: configService.get<string>('cloudinary.apiSecret'),
//     });
//   },
//   inject: [ConfigService],
// };
import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY = 'CLOUDINARY';

export const CloudinaryProvider = {
  provide: CLOUDINARY,

  useFactory: () => {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    // Quan trọng: trả về đối tượng cloudinary,
    // không return cloudinary.config(...)
    return cloudinary;
  },
};
