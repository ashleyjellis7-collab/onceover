import { CREDIT, HIGH_RISK, type RuleRecord, type RuleSet } from "./types";

// Starter rule set. Every record must be reviewed by someone with a compliance
// background before it is treated as live (brief: "Versioned rules").

const HB = "https://www.handbook.fca.org.uk/handbook";
const CHECKED = "2026-10-09";

const finprom: RuleRecord[] = [
  {
    id: "COBS-4.12A.7R-incentives",
    title: "Incentive to invest in a high-risk investment",
    score: "finprom",
    citation: "COBS 4.12A.7R",
    source: `${HB}/COBS/4/12A.html`,
    sourceVersion: CHECKED,
    appliesWhen: { products: HIGH_RISK },
    check: {
      type: "noul",
      question:
        "Does the promotion offer any bonus, cashback, referral reward, free gift or free investment for investing?",
      signals: {
        hit: [
          /\b(free|bonus)\b[^.]{0,40}\b(bitcoin|crypto|shares?|stocks?|investment|£\s?\d+)/i,
          /£\s?\d+[^.]{0,30}\b(free|bonus|cashback)\b/i,
          /\b(sign[- ]?up|welcome|referral|refer a friend)\s+(bonus|reward|offer)/i,
          /\bcashback\b/i,
        ],
      },
    },
    severity: "critical",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Remove the incentive. Transfer-only incentives may be allowed; check COBS 4.12A.7R(4).",
    examples: {
      fail: ["Get £50 free Bitcoin when you sign up"],
      pass: ["Low fees for all customers"],
    },
  },
  {
    id: "COBS-4.12A-risk-warning",
    title: "Prescribed risk warning",
    score: "finprom",
    citation: "COBS 4.12A",
    source: `${HB}/COBS/4/12A.html`,
    sourceVersion: CHECKED,
    appliesWhen: { products: HIGH_RISK },
    check: {
      type: "required_wording",
      variants: [
        "Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment and you are unlikely to be protected if something goes wrong.",
        "Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment and you should not expect to be protected if something goes wrong.",
        "Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment.",
      ],
    },
    severity: "critical",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Add the risk warning prescribed for this product type, word for word, in its own border and at least body-text size.",
  },
  {
    id: "COBS-4.12A-take-2-mins",
    title: '"Take 2 mins to learn more" link',
    score: "finprom",
    citation: "COBS 4.12A",
    source: `${HB}/COBS/4/12A.html`,
    sourceVersion: CHECKED,
    appliesWhen: {
      products: HIGH_RISK,
      channels: ["website", "social", "display_ad", "email", "video"],
    },
    check: { type: "required_wording", variants: ["Take 2 mins to learn more"] },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      'On digital media, add "Take 2 mins to learn more" linking to the risk summary.',
  },
  {
    id: "COBS-4.2-absolute-claims",
    title: "Unsupported absolute claims",
    score: "finprom",
    citation: "COBS 4.2.1R",
    source: `${HB}/COBS/4/2.html`,
    sourceVersion: CHECKED,
    appliesWhen: {},
    check: {
      type: "noul",
      question:
        'Does the promotion make an absolute claim such as "guaranteed", "risk-free" or "best" without support?',
      signals: {
        hit: [
          /\bguarantee(d|s)?\b/i,
          /\brisk[- ]free\b/i,
          /\bno risk\b/i,
          /\bcan(?:'|no)t lose\b/i,
          /\bsafe(st)? (investment|bet|returns?)\b/i,
          /\b(the )?best (rates?|returns?|investment|deal)\b/i,
        ],
        mitigate: [/\b(FSCS|Financial Services Compensation Scheme)\b/i],
      },
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Remove the absolute claim or state exactly what is guaranteed, by whom, and any limits.",
    examples: {
      fail: ["Guaranteed returns with zero risk"],
      pass: ["Your deposit is protected by the FSCS up to £85,000"],
    },
  },
  {
    id: "COBS-4.2-balance",
    title: "Benefits balanced by risks",
    score: "finprom",
    citation: "COBS 4.2, CONC 3.3, BCOBS 2.2",
    source: `${HB}/COBS/4/2.html`,
    sourceVersion: CHECKED,
    appliesWhen: {},
    check: {
      type: "noul",
      question:
        "Does the promotion emphasise potential benefits without a fair and prominent indication of the relevant risks?",
      signals: {
        hit: [
          /\b(returns?|earn|grow|profit|gains?|yield)\b/i,
        ],
        mitigate: [
          /\b(capital (is )?at risk|your capital is at risk|may (go down|fall|lose)|value .{0,30}(fall|go down)|lose (some|all)|risk warning|not a reliable indicator)\b/i,
        ],
      },
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Give the main risks the same prominence as the benefits, close to the benefit claim.",
  },
  {
    id: "COBS-4.2-firm-named",
    title: "Firm named",
    score: "finprom",
    citation: "COBS 4.2",
    source: `${HB}/COBS/4/2.html`,
    sourceVersion: CHECKED,
    appliesWhen: {},
    check: {
      type: "noul",
      question:
        "Is the promotion missing the name of the firm communicating or approving it?",
      signals: {
        hit: [/[\s\S]/],
        mitigate: [
          /\b(ltd|limited|plc|llp)\b/i,
          /\b(authorised|regulated) (and regulated )?by the (FCA|Financial Conduct Authority)\b/i,
          /\bFRN\b|\bfirm reference number\b/i,
        ],
      },
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Name the authorised firm, for example \"<Firm> Ltd is authorised and regulated by the Financial Conduct Authority (FRN ...)\".",
  },
  {
    id: "COBS-4.6-past-performance",
    title: "Past performance warning",
    score: "finprom",
    citation: "COBS 4.6",
    source: `${HB}/COBS/4/6.html`,
    sourceVersion: CHECKED,
    appliesWhen: {},
    check: {
      type: "required_wording",
      variants: [
        "Past performance is not a reliable indicator of future results",
        "Past performance is not a reliable guide to future performance",
        "Past performance is not a guide to future returns",
      ],
      triggeredBy: [
        /\b(returned|grew|gained|up|rose|delivered|outperformed)\b[^.]{0,40}\d+(\.\d+)?\s?%/i,
        /\bpast (performance|returns)\b/i,
        /\b(last|past) \d+ years?\b/i,
      ],
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Show past performance over a fair period and add a prominent warning that it is not a reliable indicator of future results.",
  },
  {
    id: "COBS-4.6-certain-projections",
    title: "Projections presented as certain",
    score: "finprom",
    citation: "COBS 4.6",
    source: `${HB}/COBS/4/6.html`,
    sourceVersion: CHECKED,
    appliesWhen: {},
    check: {
      type: "noul",
      question:
        "Does the promotion present future returns or projections as certain?",
      signals: {
        hit: [
          /\byou(?:'ll| will) (earn|make|get|receive|double)\b/i,
          /\bwill (grow|double|triple|return|earn)\b/i,
          /\b(double|triple) your (money|investment)\b/i,
        ],
        mitigate: [/\b(could|may|might|projected|forecast|not guaranteed)\b/i],
      },
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Present projections as illustrations, state the assumptions, and say returns are not guaranteed.",
  },
  {
    id: "CONC-3.5-representative-example",
    title: "Representative example when cost information is shown",
    score: "finprom",
    citation: "CONC 3.5",
    source: `${HB}/CONC/3/5.html`,
    sourceVersion: CHECKED,
    appliesWhen: { products: CREDIT },
    check: {
      type: "required_wording",
      variants: ["Representative APR", "Representative example"],
      triggeredBy: [
        /\d+(\.\d+)?\s?%\s?(APR|interest|p\.?a\.?)/i,
        /\b(low|lowest|cheap) (rates?|interest|repayments?)\b/i,
        /£\s?\d+[^.]{0,20}\b(a|per) (month|week)\b/i,
        /\binterest[- ]free\b/i,
      ],
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "This cost information triggers a representative example. Add one, with the representative APR at least as prominent as any other rate.",
  },
  {
    id: "CONC-3-bnpl-unregulated",
    title: 'Buy now, pay later described as "unregulated"',
    score: "finprom",
    citation: "CONC 3",
    source: `${HB}/CONC/3.html`,
    sourceVersion: CHECKED,
    appliesWhen: { products: ["bnpl"] },
    check: {
      type: "noul",
      question:
        "Does the promotion describe buy now, pay later credit as unregulated or not regulated by the FCA?",
      signals: {
        hit: [
          /\bunregulated\b/i,
          /\bnot (regulated|covered) by the (FCA|Financial Conduct Authority)\b/i,
        ],
      },
    },
    severity: "critical",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Deferred payment credit has been FCA-regulated since 15 July 2026. Remove the statement and add the required disclosures.",
  },
  {
    id: "FG24-1-influencer-no-firm",
    title: "Influencer post without a named authorised firm",
    score: "finprom",
    citation: "FG24/1",
    source: "https://www.fca.org.uk/publication/finalised-guidance/fg24-1.pdf",
    sourceVersion: CHECKED,
    appliesWhen: { channels: ["social"] },
    check: {
      type: "noul",
      question:
        "Is the poster an influencer or affiliate promoting a financial product without naming an authorised firm that approved the promotion?",
      signals: {
        hit: [
          /#(ad|sponsored|affiliate|gifted)\b/i,
          /\b(link in (my )?bio|use my (code|link)|my referral)\b/i,
        ],
        mitigate: [
          /\b(authorised|regulated) (and regulated )?by the (FCA|Financial Conduct Authority)\b/i,
          /\bapproved by\b/i,
        ],
      },
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "An influencer post that promotes a financial product needs approval from an authorised firm. Name the firm and confirm the approval.",
  },
  {
    id: "FG24-1-social-suitability",
    title: "Product may not suit social media",
    score: "finprom",
    citation: "FG24/1",
    source: "https://www.fca.org.uk/publication/finalised-guidance/fg24-1.pdf",
    sourceVersion: CHECKED,
    appliesWhen: { channels: ["social"], products: HIGH_RISK },
    check: {
      type: "noul",
      question:
        "Is this a complex or high-risk product being promoted on social media where the required information cannot fit?",
      signals: { hit: [/[\s\S]/] },
    },
    severity: "minor",
    thresholds: { issue: 0.95, review: 0.4 },
    fixHint:
      "Consider whether the product is suitable for this channel; the post must comply on its own without the click-through.",
  },
];

const consumerDuty: RuleRecord[] = [
  {
    id: "PRIN-2A.5-reading-age",
    title: "Reading age",
    score: "consumer_duty",
    citation: "PRIN 2A.5, FG22/5",
    source: `${HB}/PRIN/2A/5.html`,
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: { type: "reading_age", reviewAbove: 9, issueAbove: 12 },
    severity: "minor",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Use shorter sentences and everyday words. Aim for a reading age most UK adults can manage (around 9 to 11 years of schooling).",
  },
  {
    id: "PRIN-2A.5-jargon",
    title: "Undefined jargon",
    score: "consumer_duty",
    citation: "PRIN 2A.5, FG22/5",
    source: `${HB}/PRIN/2A/5.html`,
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: {
      type: "noul",
      question: "Does the text use financial jargon without explaining it?",
      signals: {
        hit: [
          /\b(AER|gross|net asset value|NAV|drawdown|liquidity|volatility|yield to maturity|basis points|bps|amorti[sz]ation|equit(y|ies) release|annuit(y|ies)|ISA wrapper|staking|DeFi|tokeni[sz]ed)\b/i,
        ],
        mitigate: [/\b(means|is the|which is|this is when|in other words)\b/i],
      },
    },
    severity: "minor",
    thresholds: { issue: 0.9, review: 0.4 },
    fixHint: "Explain each technical term in plain words the first time it appears.",
  },
  {
    id: "FG21-1-costs-in-pounds",
    title: "Costs shown in pounds, not only percentages",
    score: "consumer_duty",
    citation: "FG21/1",
    source: "https://www.fca.org.uk/publication/finalised-guidance/fg21-1.pdf",
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: { type: "costs_in_pounds" },
    severity: "minor",
    thresholds: { issue: 0.9, review: 0.4 },
    fixHint:
      "Show what the cost means in pounds, for example \"£15 a year on £1,000\", next to the percentage.",
  },
  {
    id: "FG21-1-false-urgency",
    title: "False urgency or pressure",
    score: "consumer_duty",
    citation: "FG21/1",
    source: "https://www.fca.org.uk/publication/finalised-guidance/fg21-1.pdf",
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: {
      type: "noul",
      question:
        'Does the text use false urgency ("act now", countdowns, "only 3 left") that could pressure someone under financial strain?',
      signals: {
        hit: [
          /\b(act|apply|buy|invest|sign up) (now|today)\b/i,
          /\bonly \d+ (left|remaining|spots?|places?)\b/i,
          /\b(ends|expires|closing) (tonight|today|soon|at midnight)\b/i,
          /\b(don'?t miss out|last chance|hurry|limited time|before it'?s too late|fomo)\b/i,
        ],
      },
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "Remove time pressure unless the deadline is real, and give people room to compare and think.",
  },
  {
    id: "FG21-1-life-events",
    title: "Pressure linked to life events",
    score: "consumer_duty",
    citation: "FG21/1",
    source: "https://www.fca.org.uk/publication/finalised-guidance/fg21-1.pdf",
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: {
      type: "noul",
      question:
        "Is copy aimed at bereavement, divorce, redundancy or illness in a way that adds pressure rather than support?",
      signals: {
        hit: [
          /\b(bereave\w*|lost a loved one|funeral|divorc\w*|separation|redundan\w*|lost your job|debt problems?|struggling with (bills|debt|money)|diagnos\w*)\b[\s\S]{0,200}\b(now|today|quick|fast|instant|guaranteed|easy)\b/i,
        ],
      },
    },
    severity: "major",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      "If you speak to people going through a life event, lead with support and signpost free help such as MoneyHelper.",
  },
  {
    id: "PRIN-2A.5-balance-limits",
    title: "Eligibility criteria and exclusions shown",
    score: "consumer_duty",
    citation: "PRIN 2A.5",
    source: `${HB}/PRIN/2A/5.html`,
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: {
      type: "noul",
      question:
        "Does the text overplay benefits while hiding limits, eligibility criteria or exclusions?",
      signals: {
        hit: [/\b(up to|from just|as low as|starting at)\b/i, /\*/],
        mitigate: [
          /\b(eligib\w*|criteria|subject to (status|approval)|terms (and conditions )?apply|T&Cs?|exclusions?|minimum (deposit|balance))\b/i,
        ],
      },
    },
    severity: "minor",
    thresholds: { issue: 0.8, review: 0.4 },
    fixHint:
      'Put key limits next to the claim, not only behind an asterisk or "T&Cs apply".',
  },
  {
    id: "consumer-support-route",
    title: "Clear route to help",
    score: "consumer_duty",
    citation: "PRIN 2A.6 (consumer support outcome)",
    source: `${HB}/PRIN/2A/6.html`,
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: {
      type: "noul",
      question:
        "Is there no clear route to help, contact details or alternative formats?",
      signals: {
        hit: [/[\s\S]/],
        mitigate: [
          /\b(contact us|call us|get in touch|help (centre|center)|support|speak to|live chat|alternative formats?|large print|braille)\b/i,
          /\b0\d{3}\s?\d{3}\s?\d{4}\b/,
          /\S+@\S+\.\S+/,
        ],
      },
    },
    severity: "minor",
    thresholds: { issue: 0.95, review: 0.4 },
    fixHint: "Tell people how to get help and how to ask for another format.",
  },
  {
    id: "FG21-1-all-caps",
    title: "Text in capitals",
    score: "consumer_duty",
    citation: "FG21/1 (capability)",
    source: "https://www.fca.org.uk/publication/finalised-guidance/fg21-1.pdf",
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: { type: "layout", metric: "all_caps" },
    severity: "minor",
    thresholds: { issue: 0.9, review: 0.4 },
    fixHint: "Avoid long runs of capital letters; they are harder to read, especially for people with dyslexia.",
  },
  {
    id: "FG21-1-dense-blocks",
    title: "Dense blocks of text",
    score: "consumer_duty",
    citation: "FG21/1 (capability)",
    source: "https://www.fca.org.uk/publication/finalised-guidance/fg21-1.pdf",
    sourceVersion: CHECKED,
    appliesWhen: { promotionOnly: false },
    check: { type: "layout", metric: "dense_blocks" },
    severity: "minor",
    thresholds: { issue: 0.9, review: 0.4 },
    fixHint: "Break long paragraphs up and use headings or bullet points.",
  },
];

export const ruleSetV01: RuleSet = {
  version: "v0.1",
  releasedAt: "2026-10-09",
  changelog:
    "Draft starter rule set for development. Not yet reviewed by a compliance professional.",
  rules: [...finprom, ...consumerDuty],
};
