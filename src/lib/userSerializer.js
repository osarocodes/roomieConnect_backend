export const toClientUser = (user) => ({
    _id: user._id,
    identity: {
        firstName: user.identity.firstName,
        lastName: user.identity.lastName,
        email: user.identity.email,
        phone: user.identity.phone,
        gender: user.identity.gender,
        dob: user.identity.dob,
        profilePic: user.identity.profilePic,
    },
    university: {
        level: user.university?.level,
        department: user.university?.department,
        yearOfCompletion: user.university?.yearOfCompletion,
        verifiedStudentStatus: user.university?.verifiedStudentStatus,
    },
    lifestyleHabits: user.lifestyleHabits,
    preferences: user.preferences,
    budget: user.budget,
    locationPreference: user.locationPreference,
    profile: user.profile,
});

export const toMatchUser = (user) => ({
    _id: user._id,
    identity: {
        firstName: user.identity.firstName,
        lastName: user.identity.lastName,
        dob: user.identity.dob,
        profilePic: user.identity.profilePic,
    },
    university: {
        level: user.university?.level,
        department: user.university?.department,
        verifiedStudentStatus: user.university?.verifiedStudentStatus,
    },
    profile: {
        about: user.profile?.about,
        interests: user.profile?.interests ?? [],
    },
    lifestyleHabits: {
        sleepSchedule: user.lifestyleHabits?.sleepSchedule,
        cleanliness: user.lifestyleHabits?.cleanliness,
        socialHabits: user.lifestyleHabits?.socialHabits,
        studyHabits: user.lifestyleHabits?.studyHabits,
    },
    preferences: {
        petPerson: user.preferences?.petPerson,
        cigaretteSmoker: user.preferences?.cigaretteSmoker,
        sharingPersonalItems: user.preferences?.sharingPersonalItems,
        musicVolume: user.preferences?.musicVolume,
    },
    budget: {
        rentRange: user.budget?.rentRange,
    },
});