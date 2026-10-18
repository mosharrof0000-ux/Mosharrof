# Floating chat module tests

Contract checks for this core module should verify: the New Chat button is inserted immediately before the existing options button; tap invokes the existing `#newChat` action; long-press suppresses the click action; floating mode reuses the existing `.app` DOM; pointer handlers do not bind to the microphone; and the organ stylesheet is loaded relative to `import.meta.url`.
