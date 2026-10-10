// Options for the Consumer Duty comprehension pre-test, shared by the form and the engine.

export const DEPTHS = {
  quick: {
    label: "Quick check",
    description:
      "A single short communication: a notification, SMS, short service email or one app screen. Predicts overall clarity and whether the call to action is clear.",
    maxStatements: 0,
    maxMessages: 0,
  },
  messages: {
    label: "Key messages",
    description:
      "Emails or content up to about 3 pages that customers must understand. Adds 2 or 3 key messages and true and false statements to check comprehension against.",
    maxStatements: 5,
    maxMessages: 3,
  },
  in_depth: {
    label: "In depth",
    description:
      "Longer or more complex communications: T&Cs, forms, detailed web pages, letters with several messages. Allows up to 10 true and 10 false statements.",
    maxStatements: 10,
    maxMessages: 5,
  },
} as const;
export type Depth = keyof typeof DEPTHS;

export const AUDIENCES = {
  general: { label: "General retail customers", reader: "an ordinary UK adult reading it once" },
  older: { label: "Older customers", reader: "a reader in their late seventies reading it once" },
  low_confidence: {
    label: "Low confidence with money or numbers",
    reader: "a reader with low confidence with money and numbers, reading it once",
  },
  financial_difficulty: {
    label: "Customers in financial difficulty",
    reader: "a reader under financial pressure and stress, reading it once quickly",
  },
  low_digital: {
    label: "Low digital skills",
    reader: "a reader with low digital skills, reading it once on a phone",
  },
} as const;
export type Audience = keyof typeof AUDIENCES;

export const PURPOSES = {
  promotion: "Sales or marketing",
  service_change: "Change to product, rate or terms",
  maturity_renewal: "Maturity or renewal",
  arrears: "Arrears or collections",
  onboarding: "Onboarding, T&Cs or key information",
  other: "Other service message",
} as const;
export type Purpose = keyof typeof PURPOSES;
