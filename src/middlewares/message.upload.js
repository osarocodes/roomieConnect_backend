import multer from 'multer';

const storage = multer.memoryStorage(); 

// File filter to allow only specific image formats
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (allowedTypes.includes(file.mimetype)) {
       cb(null, true); // Accept file
    } else {
       cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP are allowed.'), false); // Reject file
    }
    };

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
    },
    fileFilter,
});

export const uploadMessageImage = (req, res, next) => {
    upload.single('image')(req, res, (error) => {
        if (!error) return next();

        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Images must not exceed 10 MB.' });
        }

        return res.status(400).json({ message: error.message || 'Invalid image upload.' });
    });
};