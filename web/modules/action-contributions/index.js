(function () {
  "use strict";

  var scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : window.location.href;
  var manifestUrl = new URL("./manifest.json", scriptUrl).toString();
  var knownGroups = Object.create(null);
  var knownContributions = Object.create(null);
  var state = { status: "loading", error: null, manifest: null, annotated: 0 };

  function textOf(element) {
    return String(element && (element.textContent || element.innerText) || "")
      .replace(/\s+/g, " ").trim();
  }

  function matchesContribution(element, contribution) {
    if (!element || !contribution || !element.matches(contribution.selector)) return false;
    var match = contribution.match || {};
    if (match.attribute === "text") return textOf(element) === match.value;
    return element.getAttribute(match.attribute) === match.value;
  }

  function validateManifest(manifest) {
    if (!manifest || manifest.registry_id !== "mosharrof.ui.action_contributions" ||
        !Array.isArray(manifest.groups) || !Array.isArray(manifest.contributions)) {
      throw new Error("Action contribution manifest has an invalid shape.");
    }
    manifest.groups.forEach(function (group) {
      if (!group || !/^[a-z0-9-]{2,64}$/.test(group.id) ||
          group.placement !== "message_action_bar" || knownGroups[group.id]) {
        throw new Error("Invalid or duplicate action group.");
      }
      knownGroups[group.id] = group;
    });
    manifest.contributions.forEach(function (item) {
      if (!item || !/^[a-z0-9.-]{2,96}$/.test(item.id) ||
          !/^[a-z0-9_-]{2,48}$/.test(item.module_id) ||
          !knownGroups[item.group_id] ||
          item.placement !== "message_action_bar" ||
          typeof item.selector !== "string" ||
          !Array.isArray(item.operation_modes) ||
          item.operation_modes.indexOf("manual") < 0 ||
          item.operation_modes.indexOf("automatic") < 0 ||
          typeof item.automatic_ready !== "boolean" ||
          (item.automatic_ready && !item.automatic_policy_id)) {
        throw new Error("Invalid or unsafe action contribution: " + (item && item.id || "unknown"));
      }
      if (knownContributions[item.id]) throw new Error("Duplicate action contribution: " + item.id);
      knownContributions[item.id] = item;
    });
    return true;
  }

  function annotateExistingControls() {
    if (!state.manifest) return;
    var changed = 0;
    state.manifest.contributions.forEach(function (contribution) {
      var elements;
      try { elements = document.querySelectorAll(contribution.selector); }
      catch (error) { return; }
      Array.prototype.forEach.call(elements, function (element) {
        if (!matchesContribution(element, contribution)) return;
        if (element.getAttribute("data-action-contribution") === contribution.id) return;
        element.setAttribute("data-action-contribution", contribution.id);
        element.setAttribute("data-module-id", contribution.module_id);
        element.setAttribute("data-menu-group-id", contribution.group_id);
        element.setAttribute("data-operation-modes", "manual,automatic");
        element.setAttribute("data-automatic-ready", contribution.automatic_ready ? "true" : "false");
        if (!contribution.automatic_ready) {
          element.setAttribute("data-automatic-block-reason", contribution.automatic_block_reason || "Automatic handler is not approved.");
        }
        changed += 1;
      });
    });
    document.querySelectorAll(".message-actions").forEach(function (group) {
      group.setAttribute("data-menu-group-id", "message-actions");
      group.setAttribute("data-ui-registry", "mosharrof.ui.action_contributions");
    });
    state.annotated += changed;
  }

  function registerContribution(contribution, handlers) {
    if (!contribution || !handlers || typeof handlers.manual !== "function") return false;
    if (!contribution.id || knownContributions[contribution.id] ||
        !knownGroups[contribution.group_id] ||
        contribution.placement !== "message_action_bar") return false;
    if (contribution.operation_modes &&
        contribution.operation_modes.indexOf("automatic") >= 0 &&
        (typeof handlers.automatic !== "function" || typeof handlers.authorizeAutomatic !== "function")) {
      return false;
    }
    knownContributions[contribution.id] = contribution;
    return true;
  }

  window.MOSHARROF_ACTION_CONTRIBUTIONS = {
    getStatus: function () {
      return {
        status: state.status,
        error: state.error,
        annotated: state.annotated,
        registeredGroups: Object.keys(knownGroups).length,
        registeredContributions: Object.keys(knownContributions).length
      };
    },
    register: registerContribution,
    validate: validateManifest
  };

  fetch(manifestUrl, { credentials: "same-origin", cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("Manifest request failed: HTTP " + response.status);
      return response.json();
    })
    .then(function (manifest) {
      validateManifest(manifest);
      state.manifest = manifest;
      state.status = "ready";
      annotateExistingControls();
      if (window.MutationObserver && document.body) {
        var observer = new MutationObserver(function () { annotateExistingControls(); });
        observer.observe(document.body, { childList: true, subtree: true });
      }
      document.documentElement.setAttribute("data-action-registry-status", "ready");
    })
    .catch(function (error) {
      state.status = "blocked";
      state.error = String(error && error.message || error);
      document.documentElement.setAttribute("data-action-registry-status", "blocked");
      // Fail closed for new contributions; existing controls and handlers remain untouched.
    });
})();