import { addIcon } from "obsidian";

export const TASK_HUB_ICON_ID = "task-hub";

const TASK_HUB_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <g transform="translate(12 12) scale(1.28 1.24) translate(-12 -12)">
    <path d="M7.45 7.95h.01M7.45 11.95h.01" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
    <path d="M10.15 7.95h6.2M10.15 11.95h5.35" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8.85 16.35h3.85" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M14.05 15.3 16.55 17.8 20.1 14.25" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;

export function registerTaskHubIcon(): void {
  addIcon(TASK_HUB_ICON_ID, TASK_HUB_ICON_SVG);
}
