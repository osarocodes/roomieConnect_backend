const WEIGHTS = {
    cleanliness: 3,
    sleepSchedule: 3,
    noiseTolerance: 3,
    conflictManagement: 2.5,
    guests: 2,
    spaceSharing: 2,

    socialHabits: 1.5,
    studyHabits: 1.5,
    musicVolume: 1,

    alignmentTest: 1,
    petPerson: 0.5,
    academicLevel: 0.5,
    academicDepartment: 0.5,
};

export const similarities = (a, b) => {
    if (a === b) return 1;
    if (!a || !b) return 0;

    if (typeof a === "number" && typeof b === "number") {
        const diff = Math.abs(a - b);
        return diff === 1 ? 0.5 : 0;
    }

    return 0;
};


export const calculateScore = (currentUser, candidate) => {
    let score = 0;
    let reasons = [];
    let maxScore = 0;

    const addScore = (label, weight, valueA, valueB) => {
        maxScore += weight;
        const sim = similarities(valueA, valueB);

        if (sim > 0) {
            score += weight * sim;
            reasons.push(label);
        }
    };

    addScore(
        "Cleanliness compatibility",
        WEIGHTS.cleanliness,
        currentUser.lifestyleHabits.cleanliness,
        candidate.lifestyleHabits.cleanliness
    );

    addScore(
        "Sleep schedule compatibility",
        WEIGHTS.sleepSchedule,
        currentUser.lifestyleHabits.sleepSchedule,
        candidate.lifestyleHabits.sleepSchedule
    );

    addScore(
        "Noise tolerance compatibility",
        WEIGHTS.noiseTolerance,
        currentUser.lifestyleHabits.noiseTolerance,
        candidate.lifestyleHabits.noiseTolerance
    );

    addScore(
        "Conflict management compatibility",
        WEIGHTS.conflictManagement,
        currentUser.lifestyleHabits.conflictManagement,
        candidate.lifestyleHabits.conflictManagement
    );

    addScore(
        "Guest preference compatibility",
        WEIGHTS.guests,
        currentUser.preferences.guests,
        candidate.preferences.guests
    );

    addScore(
        "Space sharing compatibility",
        WEIGHTS.spaceSharing,
        currentUser.preferences.spaceSharing,
        candidate.preferences.spaceSharing
    );

    addScore(
        "Social habits alignment",
        WEIGHTS.socialHabits,
        currentUser.lifestyleHabits.socialHabits,
        candidate.lifestyleHabits.socialHabits
    );

    addScore(
        "Study habits alignment",
        WEIGHTS.studyHabits,
        currentUser.lifestyleHabits.studyHabits,
        candidate.lifestyleHabits.studyHabits
    );

    addScore(
        "Music volume alignment",
        WEIGHTS.musicVolume,
        currentUser.preferences.musicVolume,
        candidate.preferences.musicVolume
    );

    addScore(
        "Pet preference alignment",
        WEIGHTS.petPerson,
        currentUser.preferences.petPerson,
        candidate.preferences.petPerson
    );

    addScore(
        "Academic level alignment",
        WEIGHTS.academicLevel,
        currentUser.university.level,
        candidate.university.level
    );

    addScore(
        "Academic department alignment",
        WEIGHTS.academicDepartment,
        currentUser.university.department,
        candidate.university.department
    );

    return {
        rawScore: score,
        compatibility: Math.round((score / maxScore) * 100),
        reasons
    };
};
