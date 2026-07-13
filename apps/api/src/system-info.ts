import {
  FOUNDING_MEMBER_COUNT,
  FREE_COLLECTION_LIMIT,
  VIP_COLLECTION_LIMIT,
} from "@vinyl/shared";

export function getSystemInfo() {
  return {
    collectionLimits: {
      free: FREE_COLLECTION_LIMIT,
      vip: VIP_COLLECTION_LIMIT,
    },
    foundingMemberCount: FOUNDING_MEMBER_COUNT,
  } as const;
}
