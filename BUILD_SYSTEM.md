# MOSHARROF App Build System

## উদ্দেশ্য
ব্যবহারকারী শুধু “অ্যাপ বানাও” বললে MOSHARROF-এর orchestration layer সেই অনুরোধকে একটি পুনরায় ব্যবহারযোগ্য App Build Session-এ পরিণত করবে। ভিত্তিটি device অনুযায়ী full-bleed rendering এবং builder lifecycle সংজ্ঞায়িত করে।

## Build contract
USER REQUEST -> Intent detection -> App specification -> Responsive design plan -> Independent entity/module plan -> Build -> Automated tests -> Package/PWA -> Deployment -> Live health check

## Device contract
- Phone: touch-first, compact spacing, portrait/landscape aware.
- Tablet: দুই-প্যানেল layout যখন উপযোগী।
- Desktop/laptop: keyboard/mouse friendly, wider work areas.
- TV/large display: 10-foot UI, বড় typography/targets, landscape-first, full viewport.
- সব profile একই component/entity contract ব্যবহার করবে; আলাদা app নয়।
- Full viewport হলো 100vw x 100dvh; artificial outer gap রাখা যাবে না।
- Safe-area inset কেবল OS-reserved space-এর জন্য।
- Resize/orientation/visualViewport পরিবর্তনে profile পুনর্গণনা হবে।

## One-command behavior
MosharrofAppBuilder.fromUserRequest(text) সাধারণ Bengali/English “build/create an app” request শনাক্ত করে persistent build session শুরু করে। Session-এ specification, supported profiles, full-bleed requirement এবং understand/specify/design/build/test/package/deploy/health-check lifecycle থাকে।

এই frontend foundation নিজে production code তৈরি করার ভান করে না। ভবিষ্যৎ AI/agent backend এই session contract পড়ে বাস্তব code তৈরি, test, package, deploy ও health-check করবে। এতে AI provider বদলালেও builder contract একই থাকবে।

## Entity isolation
প্রতিটি generated app MOSHARROF entity contract অনুসরণ করবে: Identity + Logic/Brain + State + Memory + Tools + Interaction + Connection। Entity-গুলো common event bus দিয়ে যোগাযোগ করবে, কিন্তু অন্য entity-এর implementation file বদলানোর উপর নির্ভর করবে না।
