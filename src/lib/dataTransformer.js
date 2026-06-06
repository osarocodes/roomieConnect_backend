/**
 * Parses a string like "₦90,000 - ₦120,000" into a { min, max } object.
 * Handles "Less than" and "Above" cases.
 * @param {string} rangeString - The budget range string from the form.
 * @returns {{min: number, max: number}} - The parsed min/max budget object.
 */
export const parseRentRange = (rangeString) => {
    // 1. Handle empty input
    if (!rangeString) return { min: 0, max: 2147483647 }; // Using Max Int instead of Infinity

    // 2. Clean the string but keep spaces for splitting
    const cleanedString = rangeString.replace(/₦|,|#/g, '').trim();

    // 3. Extract all numbers found in the string
    const numbers = cleanedString.match(/\d+/g)?.map(Number) || [];

    // Case: "Less than 90000"
    if (cleanedString.toLowerCase().includes('less than')) {
        return { 
            min: 0, 
            max: numbers[0] || 90000 
        };
    }

    // Case: "Above 230000"
    if (cleanedString.toLowerCase().includes('above')) {
        return { 
            min: numbers[0] || 230000, 
            max: 999999999 // High number to avoid Infinity validation errors
        };
    }

    // Case: "100000 - 200000"
    if (numbers.length === 2) {
        return { 
            min: numbers[0], 
            max: numbers[1] 
        };
    }

    // Default Fallback
    return { min: 0, max: 999999999 };
};