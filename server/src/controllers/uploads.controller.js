import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const uploadDir = path.resolve('uploads/gold-items');

async function uploadToCloudinary(file) {
  const { v2: cloudinary } = await import('cloudinary');

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'gold-items',
        resource_type: 'image',
        use_filename: false,
        unique_filename: true,
        transformation: [
          {
            width: 1400,
            height: 1400,
            crop: 'limit',
            quality: 'auto:good',
            format: 'jpg',
          },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result.secure_url);
      },
    );

    stream.end(file.buffer);
  });
}

async function saveLocalFile(file, req) {
  await mkdir(uploadDir, { recursive: true });
  const extension = path.extname(file.originalname) || '.jpg';
  const filename = `${randomUUID()}${extension}`;
  await writeFile(path.join(uploadDir, filename), file.buffer);
  return `${req.protocol}://${req.get('host')}/storage/gold-items/${filename}`;
}

export async function uploadGoldItemImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required.' });
    }

    const cloudinaryUrl = process.env.CLOUDINARY_URL || '';
    const hasCloudinary = cloudinaryUrl.startsWith('cloudinary://') || Boolean(process.env.CLOUDINARY_CLOUD_NAME);
    if (cloudinaryUrl && !cloudinaryUrl.startsWith('cloudinary://')) {
      return res.status(500).json({
        message: 'Invalid CLOUDINARY_URL. It must start with cloudinary://',
      });
    }

    const imageUrl = hasCloudinary ? await uploadToCloudinary(req.file) : await saveLocalFile(req.file, req);

    return res.status(201).json({ imageUrl });
  } catch (error) {
    return next(error);
  }
}
