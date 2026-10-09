import { ruleSetV01 } from "./v0.1";
import type { RuleSet } from "./types";

export const ruleSets: RuleSet[] = [ruleSetV01];
export const latestRuleSet = ruleSets[ruleSets.length - 1];

export function getRuleSet(version: string) {
  return ruleSets.find((r) => r.version === version);
}

export * from "./types";
