// App design-system primitives (docs/Advertix UI Guide.md §4).
// Preview every component in both themes at /dev/ui (development only).
export { Button, ButtonLink, IconButton, type ButtonVariant, type ButtonSize } from "./Button";
export { Segmented, Toggle, Checkbox, type SegmentOption } from "./Controls";
export {
  Pill,
  StatusPill,
  STATUS_TONE,
  DeltaPill,
  PlatformBadge,
  PLATFORM_META,
  Card,
  CardHeader,
  Skeleton,
  EmptyState,
  type PillTone,
  type PlatformKey,
} from "./Display";
export { KpiCard, Sparkline } from "./KpiCard";
export { Menu, MenuItem, MenuLabel, MenuSeparator } from "./Menu";
export { Dialog, Drawer } from "./Overlays";
export { useConfirm, type ConfirmOptions } from "./Confirm";
export { AiMark, AiNote, AiSuggestion, type SuggestionKind, type SuggestionState } from "./Ai";
