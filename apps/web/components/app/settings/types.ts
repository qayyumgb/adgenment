/** What a Settings tab hands the page header's "Save changes" button (A14). */
export type SettingsSaver = {
  dirty: boolean;
  disabled: boolean;
  /** Why saving is disabled (tooltip). */
  reason: string | null;
  save: () => Promise<void>;
};
