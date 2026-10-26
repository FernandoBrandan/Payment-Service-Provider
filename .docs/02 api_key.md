# Consulta rápida — API con API_KEY

## Lo mínimo que tenés que decidir

### 1. ¿Quién te llama?

Antes de tocar código, respondé esto:

- **Un solo cliente** (tu ecommerce) → API key simple, hardcodeada en su `.env`.
- **Múltiples clientes** (varios comercios) → necesitás **modelar el cliente** (tabla `api_clients` con `id, name, api_key_hash, active, created_at`).
- **Clientes con permisos distintos** → sumás scopes (`payments:read`, `payments:write`, `refunds:write`).

Si es la primera vez, andá por **un solo cliente / una sola key**. No inventes multi-tenant el día 1.

### 2. Cómo se manda la key

El estándar de facto hoy (Stripe, MP, OpenAI):

```
Authorization: Bearer sk_live_abc123...s
```

**No** uses `?api_key=...` en la query — queda en logs, en el historial del browser, en el `Referer` si hay redirects. Es un chiste de seguridad.

**No** uses un header custom tipo `X-API-Key: ...` salvo que tengas una razón fuerte. `Authorization` es lo estándar y los proxies ya lo saben manejar.

### 3. Cómo se guarda del lado del servidor

**Nunca en texto plano.** Hasheada con SHA-256 (no bcrypt — la key ya tiene 256 bits de entropía, no necesita salt lento).

```sql
CREATE TABLE api_clients (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  api_key_prefix varchar(12) NOT NULL,   -- "sk_live_abc" → para lookup rápido
  api_key_hash varchar(64) NOT NULL,     -- SHA-256 de la key completa
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
```

- `api_key_prefix`: los primeros caracteres **no secretos**. Sirven para que cuando el cliente te diga "mi key es sk_live_abc..." puedas buscarla con un `WHERE prefix = ...` antes de hashear todo. Sin esto tenés que hashear la key entrante y buscar por hash completo (funciona, pero te obliga a un `WHERE hash = ...` con scan).
- `api_key_hash`: lo que comparás.
- `last_used_at`: para saber si una key quedó muerta y poder avisar al cliente.

### 4. Cómo se genera

```ts
import { randomBytes, createHash } from "node:crypto";

const raw = `sk_${env}_${randomBytes(32).toString("base64url")}`;
//            ↑              ↑ 32 bytes = 256 bits de entropía
//       "live" o "test"
```

- **Prefijo por entorno**: `sk_live_...` vs `sk_test_...`. Evita que alguien use una key de test en prod y no se entere.
- **Base64url**: sin `+/=` para que no rompa en URLs ni en headers.
- La key se muestra al cliente **una sola vez** cuando la creás. Después solo guardás el hash. Si la pierde, se genera otra.

### 5. Cómo la validás en el request

Un guard (NestJS):

```ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeyService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers["authorization"] ?? "";
    const [scheme, key] = header.split(" ");

    if (scheme !== "Bearer" || !key) throw new UnauthorizedException();
    const client = await this.apiKeys.validate(key);
    if (!client) throw new UnauthorizedException();
    req.apiClient = client;
    return true;
  }
}
```

Y en el `ApiKeyService`:

```ts
async validate(raw: string) {
  const prefix = raw.slice(0, 12)
  const hash = createHash('sha256').update(raw).digest('hex')

  const client = await this.repo.findByPrefix(prefix)
  if (!client || !client.active) return null

  // comparación constant-time
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(client.apiKeyHash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // fire & forget
  this.repo.touchLastUsed(client.id)
  return client
}
```

**`timingSafeEqual`** para que no se pueda deducir la key midiendo tiempos. Aunque en la práctica el hash ya lo mitiga, es la convención.

### 6. Cosas que vas a querer después (pero no hoy)

- **Rate limiting** por cliente (Throttler de NestJS + Redis).
- **Rotación de keys** sin downtime (dos keys activas por cliente).
- **Scopes / permisos** por cliente.
- **Webhooks salientes firmados** (HMAC-SHA256, igual que MP pero al revés).
- **Logs de requests** por cliente para auditoría.
- **Dashboard** para que el cliente vea su usage.

Nada de eso el día 1.

### 7. Test vs Live

El patrón Stripe/MP:

- Dos keys por cliente: `sk_test_...` y `sk_live_...`.
- Misma API, mismo código, distinta DB / distinto set de datos.
- El server determina el modo por el prefijo de la key. Nada más.

Te ahorra millones de "uy, mandé a prod sin querer".

---

## 6. API keys — reglas mínimas

- Header estándar: `Authorization: Bearer sk_live_...`.
- **No** usar `?api_key=` ni header custom salvo razón fuerte.
- Guardar **SHA-256 + prefijo**, nunca texto plano.
- Generar: `sk_{env}_{randomBytes(32).toString("base64url")}`.
- Prefijos `sk_live_` / `sk_test_`.
- Validar con `timingSafeEqual`.
- Después: rate limiting, rotación, scopes, logs, dashboard.
- Día 1: un cliente, una key.

## Lo que ** no ** necesitás

- **`User`** separado de `ApiClient` — el comercio es un cliente, no un usuario con login.
- Si querés dashboard, ahí sí sumás `User` con FK a `ApiClient`.
- **`Role`/`Permission`** — eso es si tenés multi-usuario por cliente. Día 1: no.
- **`Session`** — no hay login, hay API key. Sessions no aplica.

## TL;DR — primera vez

1. **Un cliente, una key** en `Authorization: Bearer`.
2. **Generación**: `sk_{env}_{randomBytes(32).base64url}`.
3. **Guardado**: SHA-256 + prefijo. Nunca texto plano.
4. **Validación**: guard NestJS + `timingSafeEqual`.
5. **Rotación, scopes, rate limit**: para después.

Eso es todo lo que necesitás para tu primera API con API keys. El resto lo agregás cuando un cliente real te lo pida.
