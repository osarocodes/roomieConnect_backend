import express from 'express';
import { getAllUsersForAdmin, deleteUser, updateUserRole, checkAdmin, verifyStudent, getUserReports, getDashboardMetrics, getPlatformSettings, updatePlatformSettings, updateUserReport } from '../controllers/admin.controllers.js';
import { getUserActivities } from '../controllers/activities.controllers.js';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/admin.middleware.js';

const router = express.Router();

router.use(protectRoute);
router.use(isAdmin);

router.get("/users", getAllUsersForAdmin);
router.get("/checkAdmin", checkAdmin);
router.get("/metrics", getDashboardMetrics);
router.get("/activities", getUserActivities);
router.get("/reports", getUserReports);
router.patch("/reports/:reportId", updateUserReport);
router.get("/settings", getPlatformSettings);
router.patch("/settings", updatePlatformSettings);

router.put("/users/:userId/verify", verifyStudent);
router.put("/users/:userId/role", updateUserRole);

router.delete("/users/:userId", deleteUser);

export default router;