import express from 'express'
import { validate } from '../middlewares/auth.validate.js'
import { loginSchema } from '../validation/schemas/loginSchema.js';
import { 
    signup, 
    login, 
    logout,
    checkAuth,
    updateUser,
} from '../controllers/auth.controllers.js'
import { getRecommendedMatches } from '../controllers/match.controllers.js';
import { upload } from '../middlewares/auth.upload.js';
import { protectRoute } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post("/signup",
    upload.fields([
        { name: "profilePic", maxCount: 1 },
        { name: "admissionLetter", maxCount: 1 },
    ]), signup
);
router.post("/login", validate(loginSchema), login);
router.post("/logout", protectRoute, logout);

router.get("/check", protectRoute, checkAuth);

router.patch("/users/me", protectRoute, upload.fields([{ name: "profilePic", maxCount: 1 }]), updateUser);

export default router