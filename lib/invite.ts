/**
 * @deprecated 请使用 lib/inviteState.ts
 * 兼容重导出，保持现有 import 不报错
 */
export {
  getInviterIdFromUrl,
  getMyPersonalityId,
  getInviteState,
  markInviteeCompleted,
  markInviteePending,
  setAsInviter,
  getSelfInviteStatus,
  useInviteStatus,
  clearInviteState,
  encodeInvite,
  decodeInvite,
} from './inviteState';
