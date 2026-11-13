# Existing Router ↔ Provisioner bridge

This integration preserves the already-running MOSHARROF Router. It does not
replace its routing policy, alter provider priority, or create a second router.

## Host wiring

The trusted server-side host constructs the existing router bridge with two
callbacks from the current router implementation:

- `select_handle(request)`: run the existing router's normal eligibility and
  selection logic; return only an opaque `vault://...` credential reference.
- `execute_with_handle(request, handle)`: let the existing router resolve that
  reference inside its server-side vault boundary and execute the requested
  operation. It must return metadata only, never token/secret/header values.

Then inject the bridge as the `router=` dependency of
`PermissionActionOrchestrator`. Inject the existing ProvisioningEngine and a
trusted authenticated ApprovalVerifier as the other dependencies.

```python
bridge = ExistingRouterBridge(
    select_handle=existing_router.select_credential_handle,
    execute_with_handle=existing_router.execute_with_handle,
)
orchestrator = PermissionActionOrchestrator(
    router=bridge,
    provisioner=provisioning_engine,
    approval_verifier=trusted_approval_verifier,
)
```

The callback names above describe the required host contract; map them to the
actual method names in the deployed Router rather than adding duplicate router
logic. The bridge rejects plaintext tokens and secret-bearing result fields.

## Token creation path

1. Existing Router checks whether an eligible credential already exists.
2. If one exists, it is reused; no new token is minted.
3. If none exists, the orchestrator returns `APPROVAL_REQUIRED`.
4. After the trusted owner-approval service authenticates and consumes an
   exact, one-time approval, the ProvisioningEngine calls the provider adapter.
5. The adapter stores the token in the encrypted vault and returns only a
   `vault://...` handle. Router can then select that handle on a subsequent run.

## Safety boundary

This is a staging adapter, not a deployed runtime endpoint. It cannot access
Router credentials or provider bootstrap credentials by itself. The host must
wire the actual existing Router callbacks and inject provider bootstrap
credentials, approval verifier, and vault from server-side secret management.
Production remains denied. Never place token values in Pages, browser payloads,
GitHub source, logs, or chat.
