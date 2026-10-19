const DESKTOP_PORT = 4318;

function desktopPort(env = process.env) {
  const raw = env.LOCALNEURON_TEST_PORT;
  if (raw === undefined || raw === '') return DESKTOP_PORT;
  if (!/^\d+$/.test(String(raw))) throw new Error('LOCALNEURON_TEST_PORT inválida. Use um número de 1 a 65535.');
  const port = Number(raw);
  if (port < 1 || port > 65535) throw new Error('LOCALNEURON_TEST_PORT inválida. Use um número de 1 a 65535.');
  return port;
}

function sessionOrigin(session, preferredPort) {
  const port = session && session.port;
  const urlText = session && session.url;
  if (!Number.isInteger(port) || port < 1 || port > 65535 || typeof urlText !== 'string') throw new Error('Sessão local inválida.');
  let url;
  try { url = new URL(urlText); } catch { throw new Error('Sessão local inválida.'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== String(port)) throw new Error('Sessão local inválida.');
  const fallback = port !== preferredPort;
  const message = fallback ? `A porta ${preferredPort} está em uso por outro programa. O LocalNeuron abriu na porta ${port}.` : null;
  return { origin: url.origin, port, fallback, message };
}

function serviceFailureMessage(output) {
  const text = String(output || '');
  const busy = text.match(/A porta \d+ está em uso por outro programa\./);
  if (busy) return busy[0];
  const invalid = text.match(/(?:LOCALNEURON_PORT|COLMEIA_PORT) inválida[^\n]*/);
  if (invalid) return invalid[0].trim();
  return 'O serviço local encerrou: ' + text;
}

module.exports = { DESKTOP_PORT, desktopPort, sessionOrigin, serviceFailureMessage };
