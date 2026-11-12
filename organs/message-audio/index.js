import { createReadAloudController, extractMessageText } from "./components/read-aloud.js";
import { createAudioDownloadButton } from "./components/audio-download.js";

export const organId = "message-audio";
let disposeCurrent = null;

export function installMessageAudioActions(options = {}) {
  const documentRef = options.documentRef || globalThis.document;
  const Observer = options.MutationObserverCtor || globalThis.MutationObserver;
  const runtime = options.runtime || null;
  const controller = options.controller || createReadAloudController(options.audioOptions || {});
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
    button.textContent = "🔊 পড়ে শোনান";
    button.title = "পাঠানো মেসেজটি পড়ে শোনান";
    button.setAttribute("aria-label", button.title);
    button.dataset.messageAudioRead = "true";
    button.addEventListener("click", async (event) => {
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      if (button.dataset.busy === "true") return;
      button.dataset.busy = "true";
      try {
        const blob = await controller.speak(extractMessageText(message), button);
        if (blob) {
          const previous = group.querySelector("[data-message-audio-download]");
          if (previous) previous.remove();
          group.appendChild(createAudioDownloadButton(blob, { documentRef }));
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
  }

  function scan(node) {
    if (!node) return;
    if (typeof node.matches === "function" && node.matches(".message.user")) attach(node);
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
