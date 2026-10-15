import * as CoreOrgan from "../organs/core/index.js";
import * as SidebarOrgan from "../organs/sidebar/index.js";
import * as VoiceOrgan from "../organs/voice/index.js";
import * as StorageOrgan from "../organs/storage/index.js";
import * as ToolFactoryOrgan from "../organs/tool-factory/index.js";
import * as QuranResearchOrgan from "../organs/quran-research/index.js";

export const extraUiOrgans = Object.freeze([
  CoreOrgan, SidebarOrgan, VoiceOrgan, StorageOrgan, ToolFactoryOrgan, QuranResearchOrgan
]);
