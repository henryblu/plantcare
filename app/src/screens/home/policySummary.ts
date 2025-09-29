import type { Plant } from "@core/models/plant";
import type { MoisturePolicy } from "@core/models/moisturePolicy";
import type { SpeciesProfile } from "@core/models/speciesProfile";

const describeDryness = (threshold: number): string => {
  if (threshold <= 4) return "Very dry";
  if (threshold <= 12) return "Mostly dry";
  if (threshold <= 25) return "Even moisture";
  if (threshold <= 40) return "Moist soil";
  return "Keep damp";
};

const describeInterval = (days: number): string => {
  if (days <= 0) return "as needed";
  if (days === 1) return "daily";
  if (days === 2) return "2–3 days";
  if (days === 3) return "3–4 days";
  if (days <= 7) return `~${days} days`;
  if (days <= 14) {
    const weeks = Math.round(days / 7);
    return weeks <= 1 ? "~1 week" : `~${weeks} weeks`;
  }
  if (days <= 45) {
    const weeks = Math.round(days / 7);
    return `~${weeks} weeks`;
  }
  const months = Math.max(1, Math.round(days / 30));
  return months === 1 ? "~1 month" : `~${months} months`;
};

const describeThreshold = (threshold: number): string =>
  threshold > 0 ? `<${threshold}%` : "when soil is dry";

export const selectPlantPolicy = (
  plant: Plant,
  profile?: SpeciesProfile,
): MoisturePolicy | null => {
  if (plant.moisturePolicyOverride) {
    return plant.moisturePolicyOverride;
  }
  return profile?.moisturePolicy ?? null;
};

export const buildMoistureSummary = (policy: MoisturePolicy): string => {
  const threshold = Math.max(0, Math.round(policy.soilMoistureThreshold));
  const cadence = Math.max(0, Math.round(policy.waterIntervalDays));

  const drynessDescriptor = describeDryness(threshold);
  const cadenceDescriptor = describeInterval(cadence);
  const thresholdDescriptor = describeThreshold(threshold);

  return `${drynessDescriptor} ${cadenceDescriptor}; water ${thresholdDescriptor}`;
};

export const buildPlantPolicySummary = (
  plant: Plant,
  profile?: SpeciesProfile,
): string | null => {
  const policy = selectPlantPolicy(plant, profile);
  if (!policy) return null;
  return buildMoistureSummary(policy);
};

const TWO_MINUTES = 2 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_WEEK = 7 * ONE_DAY;

const pluralize = (value: number, unit: string): string =>
  value === 1 ? `${value} ${unit}` : `${value} ${unit}s`;

export const formatLastUpdated = (
  isoTimestamp: string | undefined,
  referenceDate: Date = new Date(),
): string => {
  if (!isoTimestamp) return "Unknown";
  const timestamp = Date.parse(isoTimestamp);
  if (!Number.isFinite(timestamp)) {
    return "Unknown";
  }

  const diff = referenceDate.getTime() - timestamp;
  if (diff < -TWO_MINUTES) {
    return new Date(timestamp).toLocaleString();
  }

  if (Math.abs(diff) <= TWO_MINUTES) {
    return "Just now";
  }

  if (diff < ONE_HOUR) {
    const minutes = Math.max(1, Math.round(diff / (60 * 1000)));
    return `${pluralize(minutes, "minute")} ago`;
  }

  if (diff < ONE_DAY) {
    const hours = Math.max(1, Math.round(diff / ONE_HOUR));
    return `${pluralize(hours, "hour")} ago`;
  }

  if (diff < ONE_WEEK) {
    const days = Math.max(1, Math.round(diff / ONE_DAY));
    return `${pluralize(days, "day")} ago`;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    year: referenceDate.getFullYear() === new Date(timestamp).getFullYear() ? undefined : "numeric",
    month: "short",
    day: "numeric",
  });
  return formatter.format(timestamp);
};
