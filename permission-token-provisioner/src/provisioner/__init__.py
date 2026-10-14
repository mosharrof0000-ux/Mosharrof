"""Isolated MOSHARROF credential provisioning policy core.

Provider adapters and production approval/vault integrations are intentionally
not included. This package must deny privileged actions unless an external,
authenticated approval verifier confirms an exact, unexpired approval.
"""
