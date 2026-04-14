export function maskUsername(username: string): string {
  if (username.length <= 2) return username[0] + '***';
  return username[0] + '***' + username[username.length - 1];
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  const domainParts = domain.split('.');
  const maskedLocal = local.length <= 2 ? local[0] + '***' : local[0] + '***' + local[local.length - 1];
  const maskedDomain = domainParts[0].length <= 2
    ? domainParts[0][0] + '***'
    : domainParts[0][0] + '***';
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join('.')}`;
}
