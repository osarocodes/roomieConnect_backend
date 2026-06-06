export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse({ ...req.body });
    if (!result.success) {
        const formatted = result.error.flatten();
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: formatted,
        });
    }
    req.validated = result.data; // attach parsed data
    next();
};
