import express from 'express'
import { validate } from '../middlewares/auth.validate.js'
import { loginSchema } from '../validation/schemas/loginSchema.js';
import { 
    signup, 
    login, 
    logout,
    checkAuth,
    updateUser,
    requestOtp,
    verifyOtp,
    updatePassword
} from '../controllers/auth.controllers.js'
import { getRecommendedMatches } from '../controllers/match.controllers.js';
import { uploadProfilePicture, uploadSignupFiles } from '../middlewares/auth.upload.js';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { cleanupAuthUploadFiles, validateAuthUploadFiles } from '../middlewares/imageSanitizer.middleware.js';

const router = express.Router();

router.post("/signup",
    uploadSignupFiles,
    cleanupAuthUploadFiles,
    validateAuthUploadFiles,
    signup
);
router.post("/login", validate(loginSchema), login);
router.post("/logout", protectRoute, logout);
router.post("/send-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/update-password", updatePassword);

router.get("/check", protectRoute, checkAuth);

router.patch("/users/me", protectRoute, uploadProfilePicture, cleanupAuthUploadFiles, validateAuthUploadFiles, updateUser);

export default router