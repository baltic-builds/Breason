import flagsJson from "../data/feature-flags.json";
import type { FeatureFlags } from "@breason/types";

export const featureFlags = flagsJson as unknown as FeatureFlags;
