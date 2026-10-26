/*
### 7.2 Lazy desde el controller (backfill de merchants viejos)

```ts
@Post("/v1/api-clients")
@UseGuards(ApiKeyGuard)
async createOrGet(@Req() req, @Body() body: { name?: string; technicalEmail?: string }) {
  // El merchant autenticado (con su key) quiere crear SU client.
  // Pero espera: si tiene key, ya tiene client. Este endpoint es para
  // cuando el merchant NO tiene key todavía y quiere onboarding.
  // → Necesita un guard distinto: BuyerSessionGuard o similar.
}
```

Acá hay un chicken-and-egg:
**para crear un `ApiClient` necesitás autenticarte como merchant,
pero la autenticación de merchant pasa por `ApiKeyGuard` que requiere un `ApiClient`**.

**Soluciones**:

1. **Admin-only**: solo un admin puede crear `ApiClient`. El merchant pide al admin, el admin crea. Simple y seguro para portfolio.
2. **BuyerSession separado**: el merchant tiene login en el dashboard (session cookie), y desde ahí crea su `ApiClient`. Este es el modelo real (Stripe, MP).
3. **Auto-create on approval** (7.1) + admin-only para casos raros. **← Recomendación portfolio.**

Elegí **(3)**:

- `CreateApiClientUseCase` **no se expone por HTTP al merchant**.
- Se invoca internamente en `approveMerchant` (auto).
- Admin puede invocarlo manualmente vía `POST /v1/admin/api-clients` (guard: `AdminGuard`).

Esto evita el chicken-and-egg y no requiere construir session auth (que ya descartaste en `02 api_key.md`).
 */
