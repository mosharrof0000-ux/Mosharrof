import { createUiModuleOrgan } from "../../core/ui-module-adapter/index.js";
const organ = createUiModuleOrgan("quran-research");
export const organId = organ.organId;
export const initialize = organ.initialize;
export const getHealth = organ.getHealth;
export const reportIssue = organ.reportIssue;
