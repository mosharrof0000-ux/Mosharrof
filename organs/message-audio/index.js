import { createReadAloudController, extractMessageText } from "./components/read-aloud.js";
import { createAudioDownloadButton } from "./components/audio-download.js";
import { createPersonalVoiceMenu } from "./components/personal-voice-menu.js";

export const organId = "message-audio";
let disposeCurrent = null;

export function installMessageAudioActions(options = {}) {
  const documentRef = options.documentRef || globalThis.document;
  const Observer = options.MutationObserverCtor || globalThis.MutationObserver;
  const runtime = options.runtime || null;
  const controller = options.controller || createReadAloudController(options.audioOptions || {});
  const providerCapabilities = options.getProviderControlCapabilities || (runtime && typeof runtime.invoke === "function"
    ? (providerId) => runtime.invoke("personal-voice", "getProviderControlCapabilities", providerId)
    : async () => ({ controls: {} }));
  if (!documentRef || typeof Observer !== "function") return () => {};
  const root = documentRef.body || documentRef.documentElement;
  if (!root) return () => {};

  function attach(message) {
    if (!message || typeof message.matches !== "function" || !message.matches(".message.user")) return;
    const group = message.querySelector(".message-actions");
    if (!group || group.querySelector("[data-message-audio-read]")) return;

    const button = documentRef.createElement("button");
    button.type = "button";
    button.className = "message-action message-audio-read";
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg><span>পড়ে শোনান</span>';
    button.title = "পাঠানো মেসেজটি পড়ে শোনান";
    button.setAttribute("aria-label", button.title);
    button.dataset.messageAudioRead = "true";
    button.addEventListener("click", async (event) => {
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      if (button.dataset.menuOpened === "true") return;
      if (button.dataset.busy === "true") return;
      button.dataset.busy = "true";
      try {
        const blob = await controller.speak(extractMessageText(message), button);
        if (blob) {
          const previous = group.querySelector("[data-message-audio-download]");
          if (previous) previous.remove();
          group.appendChild(await createAudioDownloadButton(blob, { documentRef, title: extractMessageText(message) }));
        } else if (blob === null) {
          button.title = "ব্রাউজার ভয়েস চলছে; ডাউনলোডযোগ্য অডিও তৈরি হয়নি";
        }
      } catch {
        button.textContent = "আবার চেষ্টা করুন";
        button.title = "ভয়েস তৈরি হয়নি; আবার চেষ্টা করুন";
        if (runtime && typeof runtime.reportIssue === "function") {
          runtime.reportIssue("sent-message read-aloud failed");
        }
      } finally {
        button.dataset.busy = "false";
      }
    });
    group.appendChild(button);
    createPersonalVoiceMenu({ button, message: extractMessageText(message), controller, documentRef, getProviderControlCapabilities: providerCapabilities });
  }

  function scan(node) {
    if (!node) return;
    if (typeof node.matches === "function" && node.matches(".message.user")) {
      attach(node);
    } else if (typeof node.closest === "function") {
      // A message can be inserted before its action toolbar is rendered.
      // When the toolbar arrives later, resolve its owning sent message.
      const ownerMessage = node.closest(".message.user");
      if (ownerMessage) attach(ownerMessage);
    }
    if (typeof node.querySelectorAll === "function") {
      node.querySelectorAll(".message.user").forEach(attach);
    }
  }

  const observer = new Observer((records) => {
    records.forEach((record) => record.addedNodes.forEach(scan));
  });
  observer.observe(root, { childList: true, subtree: true });
  scan(root);
  return () => {
    observer.disconnect();
    controller.stop();
  };
}

export function initialize(runtime) {
  if (disposeCurrent) disposeCurrent();
  disposeCurrent = installMessageAudioActions({ runtime });
  return Object.freeze({ id: organId, status: "initialized" });
}

export function getHealth(runtime) {
  return runtime.health(organId);
}

export function reportIssue(runtime, summary = "message audio issue reported") {
  return runtime.reportIssue(organId, summary);
}
