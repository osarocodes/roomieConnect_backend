import multer from "multer";
import path from "path";

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
        cb(new Error("Invalid file type"), false);
    }
};

export const upload = multer({
    storage,
    fileFilter,
});