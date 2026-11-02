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

    export const upload = multer({
        storage: storage,
        limits: {
            fileSize: 10 * 1024 * 1024, // Hard limit: 10 MB
        },
        fileFilter: fileFilter,
});