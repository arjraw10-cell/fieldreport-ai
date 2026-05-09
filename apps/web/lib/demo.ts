export const DEMO_CASE_NUMBER = "MPD-2025-0519";

export const DEMO_USERS = [
  {
    name: "Officer Chen",
    role: "officer",
    canReview: true,
    canEdit: true,
    canApprove: false
  },
  {
    name: "Sgt. Rodriguez",
    role: "supervisor",
    canReview: true,
    canEdit: true,
    canApprove: true
  }
] as const;
