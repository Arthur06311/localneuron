export function listensBeyondLoopback(host) {
  const value = String(host || '').replace(/^\[|\]$/g, '').trim().toLowerCase();
  if (!value || value === 'localhost' || value === '::1' || value.startsWith('127.')) return false;
  return true;
}

export function networkExposureNotice(service) {
  return `${service} está escutando fora deste computador. Outros dispositivos desta rede conseguem acessar.`;
}

export function exposureBanner(exposed, service) {
  if (!exposed) return '';
  return `<div class="notice warn" role="alert">${networkExposureNotice(service)}</div>`;
}
