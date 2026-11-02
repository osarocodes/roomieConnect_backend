import { fileTypeFromBuffer } from 'file-type';
import { readFile, unlink } from 'node:fs/promises';
import sharp from 'sharp';

const MAX_PROFILE_PICTURE_SIZE = 10 * 1024 * 1024;
const allowedTypesByField = {
    profilePic: new Set(['image/jpeg', 'image/png', 'image/avif', 'image/webp', 'image/gif']),
    admissionLetter: new Set([
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/avif',
        'image/webp',
        'image/gif',
    ]),
};

export const validateAuthUploadFiles = async (req, res, next) => {
    const filesByField = req.files ?? {};

    try {
        for (const [fieldName, files] of Object.entries(filesByField)) {
            const allowedTypes = allowedTypesByField[fieldName];
            if (!allowedTypes) {
                return res.status(400).json({ message: 'Unexpected file field.' });
            }

            for (const file of files) {
                if (fieldName === 'profilePic' && file.size > MAX_PROFILE_PICTURE_SIZE) {
                    return res.status(413).json({ message: 'Profile pictures must not exceed 10 MB.' });
                }

                const fileBuffer = await readFile(file.path);
                const detectedType = await fileTypeFromBuffer(fileBuffer);

                if (!detectedType || !allowedTypes.has(detectedType.mime)) {
                    return res.status(400).json({
                        message: `Invalid ${fieldName} file content. Upload a supported image${fieldName === 'admissionLetter' ? ' or PDF' : ''}.`,
                    });
                }

                file.mimetype = detectedType.mime;

                if (fieldName === 'profilePic') {
                    try {
                        await sharp(fileBuffer).stats();
                    } catch {
                        return res.status(400).json({ message: 'Profile picture is invalid or corrupted.' });
                    }
                }
            }
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

export const cleanupAuthUploadFiles = (req, res, next) => {
    const files = Object.values(req.files ?? {}).flat();

    res.once('finish', () => {
        Promise.all(files.map(file => unlink(file.path))).catch(error => {
            console.error('Failed to clean up uploaded files:', error);
        });
    });

    next();
};

export const validateFileBuffer = async (req, res, next) => {
    if (!req.file) return next();

    try {
        // Read the actual binary signature from the buffer
        const detectedType = await fileTypeFromBuffer(req.file.buffer);

        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!detectedType || !allowedMimes.includes(detectedType.mime)) {
        return res.status(400).json({ error: 'Security violation: File content does not match allowed image types.' });
        }

        next();
    } catch (error) {
        return res.status(500).json({ error: 'File validation failed.' });
    }
};

export const sanitizeAndProcessImage = async (req, res, next) => {
    if (!req.file) return next();

    try {
        // Process the image: Resize it, strip all metadata, and re-encode as clean WebP/JPEG
        const sanitizedBuffer = await sharp(req.file.buffer)
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }) // Optional max dimension clamping
        .toFormat('jpeg', { quality: 80 }) // Forces a clean, fresh re-encoding
        .toBuffer();

        // Replace the raw buffer with the freshly sanitized buffer
        req.file.buffer = sanitizedBuffer;
        req.file.mimetype = 'image/jpeg';
        req.file.originalname = `${Date.now()}-sanitized.jpg`;

        next();
    } catch (error) {
        // If the file is disguised malware, Sharp will fail to parse it here!
        return res.status(400).json({ error: 'Invalid or corrupted image file.' });
    }
};