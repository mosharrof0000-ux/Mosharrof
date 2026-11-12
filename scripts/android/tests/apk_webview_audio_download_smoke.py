"""End-to-end Read Aloud and Android Downloads check for the APK smoke test."""
import json
import time


def verify_message_audio_download(cdp, output_dir, record, report):
    native_ready = bool(cdp.evaluate("""Boolean(window.Capacitor && window.Capacitor.Plugins &&
      window.Capacitor.Plugins.MessageAudioDownload &&
      typeof window.Capacitor.Plugins.MessageAudioDownload.save === "function")"""))
    record("native_message_audio_download_plugin_registered", native_ready,
           "Capacitor MessageAudioDownload plugin is exposed in APK WebView")
    if not native_ready:
        return

    read_clicked = bool(cdp.evaluate("""(() => {
      const messages = [...document.querySelectorAll("#messages .message.user")];
      const last = messages[messages.length - 1];
      const button = last && last.querySelector("[data-message-audio-read]");
      if (!button) return false;
      button.click(); return true;
    })()"""))
    record("sent_message_read_aloud_clicked", read_clicked,
           "Clicked Read Aloud on the latest sent message")
    download_ready = False
    deadline = time.monotonic() + 90
    while read_clicked and time.monotonic() < deadline:
        download_ready = bool(cdp.evaluate("""Boolean(document.querySelector(
          '#messages .message.user [data-message-audio-download]'))"""))
        if download_ready:
            break
        time.sleep(1)
    record("generated_audio_download_action_appeared", download_ready,
           "TTS generated audio bytes and exposed the Download action")
    if not download_ready:
        return

    clicked = bool(cdp.evaluate("""(() => {
      const messages = [...document.querySelectorAll("#messages .message.user")];
      const last = messages[messages.length - 1];
      const button = last && last.querySelector("[data-message-audio-download]");
      if (!button) return false;
      button.click(); return true;
    })()"""))
    record("audio_download_action_clicked", clicked,
           "Clicked Download Audio in the installed APK")
    saved = False
    deadline = time.monotonic() + 45
    while clicked and time.monotonic() < deadline:
        saved = bool(cdp.evaluate("""Boolean(document.querySelector(
          '#messages .message.user [data-download-complete="true"]'))"""))
        if saved:
            break
        time.sleep(0.5)
    state = cdp.evaluate("""(() => {
      const node = document.querySelector("#messages .message.user [data-message-audio-download]");
      return node ? {title:node.title, filename:node.dataset.filename,
        complete:node.dataset.downloadComplete === "true",
        error:node.dataset.downloadError || ""} : null;
    })()""")
    record("android_audio_file_saved_to_downloads", saved,
           json.dumps(state, ensure_ascii=False)[:500])
    report["audio_download"] = state
    cdp.screenshot(output_dir / "apk-webview-audio-download.png")
