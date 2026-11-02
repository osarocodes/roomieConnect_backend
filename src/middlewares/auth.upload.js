import multer from "multer";

const storage = multer.diskStorage({
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf", "image/avif", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, PDF, AVIF, WEBP, and GIF files are allowed."), false);
    }
};

export const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 2,
        parts: 4,
    },
    fileFilter,
});

const handleUploadErrors = (middleware) => (req, res, next) => {
    middleware(req, res, (error) => {
        if (!error) return next();

        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "Uploaded files must not exceed 10 MB." });
        }

        return res.status(400).json({ message: error.message || "Invalid file upload." });
    });
};

export const uploadSignupFiles = handleUploadErrors(upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "admissionLetter", maxCount: 1 },
]));

export const uploadProfilePicture = handleUploadErrors(upload.fields([
    { name: "profilePic", maxCount: 1 },
]));