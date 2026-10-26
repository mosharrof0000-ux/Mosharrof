# MOSHARROF AI — Faceless YouTube Shorts Workflow

## Purpose
Turn verified MOSHARROF AI development progress into short, useful YouTube videos without showing the creator's face or recording the creator's own voice. This is a production guide, not a claim that video automation or YouTube publishing is already integrated into the app.

## Safe publishing rule
- Record only the actual website/app and real GitHub evidence.
- Label a feature as **in progress**, **tested**, or **live** accurately.
- A green CI run is not proof that real-provider chat or a physical Android phone works.
- Never show API keys, tokens, passwords, private messages, account identifiers, browser autofill, or personal notifications.
- Do not show a fabricated success screen or present a mock-up as a working feature.
- Keep the main branch and Live site protected; video production must not require deploying unverified code.

## Repeatable production recipe
1. Pick one small, verified change or one clearly documented problem.
2. Capture a clean 9:16 (1080 × 1920) screen recording from the public Live site or a labelled PR preview. Use the preview when the feature is not live.
3. Record 3–5 short shots: hook, what is being built, a real test/evidence view, and the result or remaining limitation.
4. Add Bengali on-screen captions and optional royalty-safe background music. Use no voice track by default. If narration is wanted later, use a licensed synthetic voice and clearly avoid impersonating a real person.
5. Keep the final edit around 20–35 seconds. Use large high-contrast text, one point per shot, and leave safe margins for Shorts interface overlays.
6. Watch the entire export on a phone before uploading. Check text legibility, crop, audio rights, privacy, and whether every claim is supported by the footage.
7. Save the source recording, final export, caption text, title, description, and evidence URL in a dated folder.

## 30-second storyboard template
- **0–3 sec — Hook:** “AI বানাচ্ছি—কিন্তু প্রতিটি ফিচার সত্যিই কাজ করছে তো?”
- **3–9 sec — Show:** Show the actual MOSHARROF AI page or a clearly labelled preview.
- **9–17 sec — Build:** Show one small feature, code change, or GitHub PR. Hide sensitive details.
- **17–25 sec — Verify:** Show the real test result. If the test failed, show the problem and explain the next step rather than implying success.
- **25–30 sec — Close:** “পরের আপডেট দেখতে Subscribe করুন — MOSHARROF AI.”
- **Optional end card:** “Build • Test • Improve” with the project name.

## Ready-to-use first Short (status-safe)
**Topic:** Building MOSHARROF AI in public  
**Length:** 25–30 seconds  
**Format:** Vertical screen recording + Bengali text captions; no face and no creator voice.

Caption sequence:
1. “নিজের AI প্রজেক্ট ধীরে ধীরে তৈরি করছি”
2. “প্রতিটি পরিবর্তন আলাদা শাখায়”
3. “তারপর টেস্ট, সমস্যা খোঁজা, আবার ঠিক করা”
4. “সবুজ CI মানেই ফোনে সব ঠিক—এমন নয়”
5. “তাই Live ও Android আলাদা করে যাচাই করছি”
6. “MOSHARROF AI — কাজ চলছে”

Use only footage that matches the current real state. The phrase “যাচাই করছি” is appropriate for work in progress; do not replace it with “সব সফল” unless there is matching evidence.

## Upload metadata template
**Title:** মোশাররফ AI তৈরি করছি | Build in Public #01 #Shorts

**Description:**
আমি ধাপে ধাপে MOSHARROF AI তৈরি করছি। নতুন ফিচার, পরীক্ষা, ভুল ধরা এবং উন্নতির বাস্তব অগ্রগতি এখানে ছোট ভিডিওতে দেখাব। কোনো ফিচার পরীক্ষাধীন থাকলে সেটি পরীক্ষাধীন বলেই জানানো হবে।

Live project: https://mosharrof0000-ux.github.io/Mosharrof/
Repository and evidence: https://github.com/mosharrof0000-ux/Mosharrof

**Hashtags:** #MosharrofAI #BuildInPublic #BanglaTech #AIProject #Shorts

## Suggested folder layout for future video assets
Keep generated/recorded assets out of the web deployment directory:
- `content/youtube-shorts/YYYY-MM-DD/topic/recording.mp4`
- `content/youtube-shorts/YYYY-MM-DD/topic/final.mp4`
- `content/youtube-shorts/YYYY-MM-DD/topic/captions.txt`
- `content/youtube-shorts/YYYY-MM-DD/topic/metadata.md`
- `content/youtube-shorts/YYYY-MM-DD/topic/evidence-links.md`

Do not commit large video files or recordings containing secrets to the source repository. Use private local/cloud storage for media; commit only reusable scripts, metadata templates, and non-sensitive evidence references.

## Acceptance checklist
- [ ] One topic only; 20–35 seconds; vertical 9:16.
- [ ] No face and no creator voice.
- [ ] All screen footage is genuine and correctly labelled Live or Preview.
- [ ] Claims match test evidence; failures are not hidden behind a false success claim.
- [ ] No credentials, private messages, or personal notifications visible.
- [ ] Captions are readable on a phone and do not overlap Shorts controls.
- [ ] Music/assets have permission for YouTube use.
- [ ] Export reviewed on a phone before upload.
- [ ] Title, description, hashtags, and evidence URL saved.
- [ ] Upload/publish remains a manual, user-controlled step unless a separate authorized publishing integration is implemented and verified.
