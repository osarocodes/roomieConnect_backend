export const isAdmin = (req, res, next) => {
    try {
        if (req.user.identity.role !== "Admin") {
            return res.status(403).json({ success: false, message: "Access denied. Admins only." });
        }
        next();
    } catch (error) {
        console.error("Admin Middleware Error:", error.message);
        return res.status(500).json({ success: false, message: "Server error during admin check.", error: error.message });
    }
}