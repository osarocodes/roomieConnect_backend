import { z } from "zod";
import { parseRentRange } from "../../lib/dataTransformer.js";

const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,30}$/;
const phoneRegex = /^\+?[0-9]{9,15}$/;


export const signupSchema = z.object({
    identity: z.object({
        firstName: z.string().min(2).max(30).regex(nameRegex),
        lastName: z.string().min(2).max(30).regex(nameRegex),
        email: z.email(),
        phone: z.string().regex(phoneRegex),
        gender: z.enum(["male", "female", "any"]),
        // religion: z.string().min(2).max(50),
        dob: z.string(),
    }),

    auth: z.object({
        password: z.string().min(8),
        confirmPassword: z.string(),
    }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    }),

    university: z.object({
        level: z.string().min(1),
        department: z.string().min(2),
        yearOfCompletion: z.string().min(1),
        verifiedStudentStatus: z.boolean().optional(),
    }),

    lifestyleHabits: z.object({
        sleepSchedule: z.enum(["Early sleeper, early riser.", "Night owl, late mornings.", "Flexible, depends on the day.", "I barely sleep."]),
        cleanliness: z.enum(["Honestly, I only clean when someone's coming over.", "I wait till I can’t take it anymore.", "I clean once I start feeling uncomfortable.", "I clean immediately."]), 
        socialHabits: z.enum(["Party night, for sure.", "With a group, maybe an outing.", "With 1-2 close friends.", "Alone in my space."]),
        studyHabits: z.enum(["Prefers Quiet Study Environment", "Study with company", "Flexible"]),
        noiseTolerance: z.enum(["I need complete silence.", "Low background noise is okay.", "I like music or people around.", "I thrive in chaos."]),
        conflictManagement: z.enum(["Confront them directly.", "Let it slide but remember it.", "Ask why they did it, then respond.", "Talk to them gently about it."]),
        alignmentTest: z.enum(["Clean space, clear mind.", "I'll do it tommorrow, I swear.", "The Vibe is more Important than the clock.", "I go with the flow, always."])
    }),

    preferences: z.object({
        petPerson: z.enum(["No pets", "Pet-friendly", "Depends"]),
        cigaretteSmoker: z.enum(["Non-smoker", "Smoker", "It's in the past"]),
        guests: z.enum(["Not comfortable with guests", "Occasional guests only", "Frequent guests allowed", "Overnight guests okay"]),
        spaceSharing: z.enum(["Not a problem, I like people around.", "Okay, as long as they're respectful.",  "Kinda annoying - I need my peace.", "That's a hard no. My space is private."]),
        musicVolume: z.enum(["Low", "Medium", "High", "Flexible"]),
        preferredGender: z.enum(["male", "female", "any"]),
        sharingPersonalItems: z.enum(["Low - my things are mine", "Occasionally - Only if it's necessary", "Often - Sharing is caring, but with moderation"])
    }),

    budget: z.object({
        rentRange: z.preprocess(
        (val) => {
            if (typeof val === "string") return parseRentRange(val);
            return val;
        },
        z.object({
            min: z.number().nonnegative(),
            max: z.number().nullable(),
            currency: z.string().default("NGN")
        }))
    }),

    locationPreference: z.object({
        preferredArea: z.enum(["Bdpa", "Osasogie", "Ekosodin"]),
        houseOwnership: z.enum(["Yes", "No"])
    }),

    profile: z.object({
        about: z.string().min(20).max(1000),
        interests: z.array(z.string().min(1)).min(1),
    }),
    meta: z.object({
        age: z.number().int().min(16).max(120).optional(),
        compatibility: z.number().int().min(0).max(100).optional(),
        universityName: z.string().min(2).optional(),
    }).optional(),
});