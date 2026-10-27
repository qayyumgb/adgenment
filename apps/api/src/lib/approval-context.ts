/**
 * Approval replay context (plan C1). While an approved request is being run
 * again, change-log entries it writes are tagged with the approval and who
 * approved it. AsyncLocalStorage keeps that to the replay's own calls, even
 * with other requests running at the same time.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type ApprovalContext = { approvalId: string; approvedById: string | null };

export const approvalContext = new AsyncLocalStorage<ApprovalContext>();
