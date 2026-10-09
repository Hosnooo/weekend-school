/** Preserve source inheritance unless an Administrator actually changes the
 * visible Teacher comment. Once explicitly overridden, an empty value means
 * deliberately cleared; it must stay authoritative over future Teacher edits.
 * Hidden template controls never create new override decisions.
 */
export function resolveReportCommentOverride(input: {
  visible: boolean;
  wasOverridden: boolean;
  currentComment: string | null;
  submittedComment: string | null;
}): boolean {
  if (!input.visible) return input.wasOverridden;
  return input.wasOverridden ||
    input.currentComment !== input.submittedComment;
}
