export const FREE_COLLECTION_LIMIT = 10;
export const VIP_COLLECTION_LIMIT = 10_000;
export const FOUNDING_MEMBER_COUNT = 10;

export interface CollectionAccessInput {
  membershipExpiresAt: Date | null;
  now: Date;
}

export interface CollectionAccess {
  isVip: boolean;
  collectionLimit: number;
}

export function getCollectionAccess({
  membershipExpiresAt,
  now,
}: CollectionAccessInput): CollectionAccess {
  const isVip = membershipExpiresAt !== null && membershipExpiresAt.getTime() > now.getTime();

  return {
    isVip,
    collectionLimit: isVip ? VIP_COLLECTION_LIMIT : FREE_COLLECTION_LIMIT,
  };
}

export interface FoundingMemberInput {
  registrationSequence: number;
  registeredAt: Date;
}

export function getFoundingMemberExpiry({
  registrationSequence,
  registeredAt,
}: FoundingMemberInput): Date | null {
  if (registrationSequence < 1 || registrationSequence > FOUNDING_MEMBER_COUNT) {
    return null;
  }

  return addUtcCalendarYear(registeredAt);
}

function addUtcCalendarYear(value: Date): Date {
  const targetYear = value.getUTCFullYear() + 1;
  const targetMonth = value.getUTCMonth();
  const targetDay = value.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(targetDay, lastDayOfTargetMonth),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ),
  );
}
