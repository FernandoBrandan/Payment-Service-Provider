// 4. Guard de autenticación (cómo se usa)

// Así se conecta todo. No es código nuevo, es para que veas cómo encajan las entidades:

/* async canActivate(ctx: ExecutionContext): Promise<boolean> {
  // 1. Extraer Bearer
  const raw = extractBearer(ctx);
  if (!raw) throw new UnauthorizedException("missing_token");

  // 2. Lookup por prefix (NO por hash completo → scan innecesario)
  const prefix = raw.slice(0, 12);
  const credential = await this.credentialRepo.findByPrefix(prefix);
  if (!credential) throw new UnauthorizedException("invalid_token");
  if (!credential.isActive()) throw new UnauthorizedException("revoked_token");

  // 3. Comparación constant-time
  if (!credential.verify(raw)) throw new UnauthorizedException("invalid_token");

  // 4. Resolver ApiClient + Merchant
  const apiClient = await this.apiClientRepo.findById(credential.apiClientId);
  if (!apiClient || !apiClient.isActive()) {
    throw new UnauthorizedException("client_suspended");
  }
  const merchant = await this.merchantRepo.findById(apiClient.merchantProfileId);
  if (!merchant || !merchant.isActive()) {
    throw new UnauthorizedException("merchant_inactive");
  }

  // 5. Adjuntar contexto al request
  ctx.switchToHttp().getRequest().auth = { credential, apiClient, merchant };

  // 6. Fire & forget lastUsedAt
  credential.touch();
  this.credentialRepo.save(credential).catch(() => {});

  return true;
}
*/
