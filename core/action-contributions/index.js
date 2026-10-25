(function () {
  "use strict";

  var manifestUrl = new URL("./manifest.json", import.meta.url).toString();
  var knownGroups = Object.create(null);
  var knownContributions = Object.create(null);
  var knownHandlers = Object.create(null);
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
    Array.prototype.forEach.call(document.querySelectorAll(".message-actions"), function (group) {
      group.setAttribute("data-menu-group-id", "message-actions");
      group.setAttribute("data-ui-registry", "mosharrof.ui.action_contributions");
    });
    state.annotated += changed;
    mountRegisteredContributions();
  }

  function runManual(id, context) {
    var item = knownContributions[id], handlers = knownHandlers[id];
    if (!item || !handlers || typeof handlers.manual !== "function") {
      return { status: "BLOCKED_CONFIG", reason: "Manual handler is not registered." };
    }
    try {
      var result = handlers.manual(context || {});
      if (typeof handlers.verify === "function" && handlers.verify(result, context || {}) !== true) {
        return { status: "FAILED", reason: "Manual result did not pass verification." };
      }
      return { status: "VERIFIED", result: result == null ? null : result };
    } catch (error) {
      return { status: "FAILED", reason: String(error && error.message || error) };
    }
  }

  function runAutomatic(id, context) {
    var item = knownContributions[id], handlers = knownHandlers[id], task = context || {};
    if (!item || !handlers || !item.automatic_policy_id ||
        item.automatic_ready !== true || typeof handlers.automatic !== "function" ||
        typeof handlers.authorizeAutomatic !== "function" || typeof handlers.verify !== "function") {
      return { status: "BLOCKED_CONFIG", reason: "Automatic handler, policy, or verification is missing." };
    }
    try {
      if (handlers.authorizeAutomatic(task) !== true) {
        return { status: "BLOCKED_APPROVAL", reason: "Automatic policy did not authorize this task." };
      }
      var result = handlers.automatic(task);
      if (handlers.verify(result, task) !== true) {
        return { status: "FAILED", reason: "Automatic result did not pass verification." };
      }
      return { status: "VERIFIED", result: result == null ? null : result };
    } catch (error) {
      return { status: "FAILED", reason: String(error && error.message || error) };
    }
  }

  function mountOne(group, contribution) {
    if (!group || group.getAttribute("data-menu-group-id") !== contribution.group_id) return;
    var existing = group.querySelector('[data-action-contribution="' + contribution.id + '"]');
    if (existing) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "message-action";
    button.textContent = contribution.label;
    button.setAttribute("data-action-contribution", contribution.id);
    button.setAttribute("data-module-id", contribution.module_id);
    button.setAttribute("data-menu-group-id", contribution.group_id);
    button.setAttribute("data-operation-modes", "manual,automatic");
    button.setAttribute("data-automatic-ready", contribution.automatic_ready ? "true" : "false");
    button.addEventListener("click", function (event) {
      event.stopPropagation();
      var result = runManual(contribution.id, {
        messageRoot: group.closest(".message"),
        button: button,
        mode: "manual"
      });
      button.setAttribute("data-execution-status", result.status);
    });
    group.appendChild(button);
  }

  function mountRegisteredContributions() {
    Object.keys(knownHandlers).forEach(function (id) {
      var contribution = knownContributions[id];
      Array.prototype.forEach.call(document.querySelectorAll(".message-actions"), function (group) {
        mountOne(group, contribution);
      });
    });
  }

  function registerContribution(contribution, handlers) {
    if (!state.manifest || !contribution || !handlers ||
        !/^[a-z0-9.-]{2,96}$/.test(contribution.id || "") ||
        !/^[a-z0-9_-]{2,48}$/.test(contribution.module_id || "") ||
        knownContributions[contribution.id] ||
        !knownGroups[contribution.group_id] ||
        contribution.placement !== "message_action_bar" ||
        !String(contribution.label || "").trim() ||
        !Array.isArray(contribution.operation_modes) ||
        contribution.operation_modes.indexOf("manual") < 0 ||
        contribution.operation_modes.indexOf("automatic") < 0 ||
        contribution.automatic_ready !== true ||
        !String(contribution.automatic_policy_id || "").trim() ||
        typeof handlers.manual !== "function" ||
        typeof handlers.automatic !== "function" ||
        typeof handlers.authorizeAutomatic !== "function" ||
        typeof handlers.verify !== "function") return false;
    knownContributions[contribution.id] = contribution;
    knownHandlers[contribution.id] = handlers;
    mountRegisteredContributions();
    return true;
  }

  window.MOSHARROF_ACTION_CONTRIBUTIONS = {
    getStatus: function () {
      return {
        status: state.status,
        error: state.error,
        annotated: state.annotated,
        registeredGroups: Object.keys(knownGroups).length,
        registeredContributions: Object.keys(knownContributions).length,
        executableContributions: Object.keys(knownHandlers).length
      };
    },
    register: registerContribution,
    runManual: runManual,
    runAutomatic: runAutomatic,
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