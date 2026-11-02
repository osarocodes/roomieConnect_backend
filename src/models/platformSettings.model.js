import mongoose from 'mongoose';

export const DEFAULT_MATCHING_SETTINGS = Object.freeze({
    resultLimit: 20,
    minimumCompatibility: 0,
    requireVerifiedStudents: false,
});

const matchingSettingsSchema = new mongoose.Schema({
    resultLimit: { type: Number, min: 1, max: 50, default: DEFAULT_MATCHING_SETTINGS.resultLimit },
    minimumCompatibility: { type: Number, min: 0, max: 100, default: DEFAULT_MATCHING_SETTINGS.minimumCompatibility },
    requireVerifiedStudents: { type: Boolean, default: DEFAULT_MATCHING_SETTINGS.requireVerifiedStudents },
}, { _id: false });

const platformSettingsSchema = new mongoose.Schema({
    key: { type: String, default: 'global', unique: true, immutable: true },
    matching: { type: matchingSettingsSchema, default: () => ({}) },
}, { timestamps: true });

export default mongoose.model('PlatformSettings', platformSettingsSchema);