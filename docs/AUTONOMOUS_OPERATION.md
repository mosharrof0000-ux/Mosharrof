# Mosharrof Autonomous Operation

## Purpose
Mosharrof may perform scheduled inspection and verified project work without requiring a new human message for every maintenance cycle.

## Six-hour cycle
Every six hours the system runs tests, policy checks and the live-artifact integrity check.

## Feature requests
A human instruction such as "add screenshot analysis" is treated as a task request. The implementation must occur outside main, pass tests and policy verification, and only then become eligible for controlled promotion.

## Live boundary
Main/Live is a protected output boundary. Agents do not edit Live directly. Promotion is a separate controlled step.

## Screenshot analysis
Screenshot-analysis capability must use an authorized image-capable runtime/input path. No fake or guessed image-processing capability is permitted. If the required image provider credential/input connector is absent, the task remains pending rather than being promoted as a non-functional feature.

## Safety
DELETE and destructive operations remain blocked. Failed verification never promotes.
