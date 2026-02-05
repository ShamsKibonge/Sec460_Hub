// In-memory store: email -> { codeHash, expiresAt, attemptsLeft, lastSentAt }
export const otpStore = new Map();
