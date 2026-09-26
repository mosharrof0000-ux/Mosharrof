# Mosharrof Visual Inspector

The visual inspector opens the deployed Mosharrof URL in a real Chromium browser, captures a screenshot, and checks the required UI structure.

It is intentionally read-only:
- no source edits
- no main writes
- no deployment permissions
- screenshot is stored as a workflow artifact
- visual inspection can run every 6 hours

Future versions can compare this screenshot with the last approved baseline using a visual-diff model.