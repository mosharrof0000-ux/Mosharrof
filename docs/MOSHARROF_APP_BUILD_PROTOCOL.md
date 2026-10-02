# MOSHARROF — One-Instruction App Build Protocol

## Goal
A future user instruction such as "এই ধারণা অনুযায়ী একটি অ্যাপ বানাও" is treated as a build request, not a mockup request.

## Standard pipeline
1. Interpret the request.
2. Create a machine-readable specification.
3. Plan entities, core, UI shell, state, memory, tools, tests and deployment.
4. Create an isolated feature branch from protected main.
5. Implement the requested app.
6. Run tests.
7. Run visual QA on compact phone, phone, tablet/desktop and large-display profiles.
8. Open a pull request.
9. Wait for required checks.
10. Promote only through protected merge.
11. Deploy GitHub Pages.
12. Run a live health check.
13. Document the final change and live result.

## Device rule
MOSHARROF apps are viewport-native. Use 100dvw and 100dvh, safe-area insets and fluid clamp sizing. Never place the app inside a fixed 390px phone canvas. The same application identity and Entities remain present across phones, low-height displays, tablets, laptops, desktops and 56-inch-class TVs; only density, scale and layout composition adapt to the actual viewport.

## Entity rule
Entity = Identity + Logic/Brain + State + Memory + Tools + Interaction + Connection.

An Entity should be independently replaceable. Shared infrastructure is supplied by the MOSHARROF Core and Entity Bus.

## Safety and promotion rule
No direct main writes, secret reads, force-pushes, unrelated destructive operations, or branch-protection bypasses. A deployment is not called successful until the live health check passes.

## Canonical contract
The file web/app-factory/build-contract.json is the machine-readable build contract. web/app-factory/app-builder.js exposes MosharrofAppBuilder for queued build requests and deterministic pipeline events. The browser object does not pretend to generate source code; repository-side automation performs actual implementation and promotion.

## Definition of done
Behavior works, target-device layouts are verified, tests and visual QA pass, PR checks pass, protected promotion completes, Pages deploy succeeds, live health check succeeds, and the result is documented.
