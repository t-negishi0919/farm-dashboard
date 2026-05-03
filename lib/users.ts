/**
 * 勤怠の対象ユーザー。
 * 後から追加する場合はこの配列に名前を足してください。
 */
export const TIMECLOCK_USERS = ["大輔", "正直", "清江"] as const;

export type TimeclockUser = (typeof TIMECLOCK_USERS)[number];

export function isValidUser(name: string): name is TimeclockUser {
  return (TIMECLOCK_USERS as readonly string[]).includes(name);
}
