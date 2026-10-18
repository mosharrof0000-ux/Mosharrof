export function initializeThemeToggle(header, newChatButton) {
  if (!header || !newChatButton || document.getElementById("topThemeToggle")) return;
  var button = document.createElement("button");
  button.className = "top-theme-toggle";
  button.id = "topThemeToggle";
  button.type = "button";
  button.setAttribute("aria-label", "দিন/রাতের থিম বদলান");
  button.title = "দিন/রাতের থিম";
  function applyTheme(theme) {
    var next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    button.setAttribute("aria-pressed", next === "light" ? "true" : "false");
    button.innerHTML = next === "light"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>';
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", next === "light" ? "#f5f7fb" : "#000000");
    try { localStorage.setItem("mosharrof_theme", next); } catch (_) {}
  }
  var saved = "dark";
  try { saved = localStorage.getItem("mosharrof_theme") || "dark"; } catch (_) {}
  applyTheme(saved);
  button.addEventListener("click", function (event) {
    event.preventDefault(); event.stopPropagation();
    applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  });
  header.insertBefore(button, newChatButton);
}
