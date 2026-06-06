import mongoose from "mongoose";

const RentRangeSchema = new mongoose.Schema({
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  currency: { type: String, required: true, default: "NGN" }
}, { _id: false });

const BudgetSchema = new mongoose.Schema({
  rentRange: { type: RentRangeSchema, required: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
  // 1️⃣ Identity Information
  identity: {
    firstName: { type: String, required: true, index: true },
    lastName: { type: String, required: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String },
    gender: { type: String, enum: ["male", "female", "any"], required: true },
    // religion: { type: String, required: true },
    dob: { type: String },
    profilePic: { type: String, default: "default-avatar.png", required: true },
    role: { type: String, enum: ["User", "Admin"], default: "User" },
  },

  // 2️⃣ Authentication
  auth: {
    password: { type: String, required: true },
  },

  // 3️⃣ University / Academic Info
  university: {
    level: { type: String },
    department: { type: String },
    yearOfCompletion: { type: String }, // e.g 2028
    verifiedStudentStatus: { type: Boolean, default: false },
  },

  // 4️⃣ Lifestyle Habits (aligned with signup schema)
  lifestyleHabits: {
    sleepSchedule: { type: String, enum: ["Early sleeper, early riser.", "Night owl, late mornings.", "I barely sleep.", "Flexible, depends on the day."] },
    cleanliness: { type: String, enum: [
      "Honestly, I only clean when someone's coming over.",
      "I wait till I can’t take it anymore.",
      "I clean once I start feeling uncomfortable.",
      "I clean immediately."
    ]},
    socialHabits: { type: String, enum: [
      "Party night, for sure.",
      "With a group, maybe an outing.",
      "With 1-2 close friends.",
      "Alone in my space."
    ]},
    studyHabits: { type: String, enum: [
      "Prefers Quiet Study Environment",
      "Study with company",
      "Flexible"
    ]},
    noiseTolerance: { type: String, enum: ["I need complete silence.", "Low background noise is okay.", "I like music or people around.", "I thrive in chaos."] },
    musicVolume: { type: String, enum: ["Low", "Medium", "High", "Flexible"] },
    conflictManagement: { type: String, enum: [
      "Confront them directly.",
      "Let it slide but remember it.",
      "Ask why they did it, then respond.",
      "Talk to them gently about it."
    ]},
    alignmentTest: { type: String, enum: [
      "Clean space, clear mind.",
      "I'll do it tommorrow, I swear.",
      "The Vibe is more Important than the clock.",
      "I go with the flow, always."
    ]},
  },

  // 5️⃣ Roommate Preferences (aligned with signup schema)
  preferences: {
    petPerson: { type: String, enum: ["No pets", "Pet-friendly", "Depends"] },
    cigaretteSmoker: { type: String, enum: ["Non-smoker", "Smoker", "It's in the past"] },
    guests: { type: String, enum: [
      "Not comfortable with guests",
      "Occasional guests only",
      "Frequent guests allowed",
      "Overnight guests okay"
    ]},
    spaceSharing: { type: String, enum: [
      "Not a problem, I like people around.",
      "Okay, as long as they're respectful.",
      "Kinda annoying - I need my peace.",
      "That's a hard no. My space is private."
    ]},
    musicVolume: { type: String, enum: ["Low", "Medium", "High", "Flexible"] },
    preferredGender: { type: String, enum: ["male", "female", "any"], default: "any" },
    sharingPersonalItems: { type: String, enum: [
      "Low - my things are mine",
      "Occasionally - Only if it's necessary",
      "Often - Sharing is caring, but with moderation"
    ]},
  },

  // 6️⃣ Budget Info
  budget: { type: BudgetSchema, required: true },

  // 7️⃣ Location preference
  locationPreference: {
    preferredArea: { type: String },
    houseOwnership: { type: String, enum: ["Yes", "No"] },
  },

  // 8️⃣ Profile Meta
  profile: {
    about: { type: String },
    interests: [{ type: String }],
  },

  // Documents (aligned with signupSchema 'document')
  document: {
    admissionLetter: { type: String, required: true }
  },

  meta: {
    age: { type: Number },
    compatibility: { type: Number },
    universityName: { type: String }
  }
},
{ timestamps: true }
);

export default mongoose.model("User", userSchema);