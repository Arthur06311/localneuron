function redactSensitive(value, secrets = []) {
  let text = String(value ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 8) text = text.split(secret).join('••••');
  }
  text = text.replace(/\b(?:hf_|sk-ant-|sk-|lnp_|clm_|xai-|Bearer\s+)[A-Za-z0-9_\-./+=]{6,}/gi, '••••');
  text = text.replace(/(?:\/(?:Users|home|root|private\/var)\/)[^\s'"<>]*/g, '~/…');
  text = text.replace(/[A-Za-z]:\\Users\\[^\s'"<>]*/g, '~\\…');
  return text;
}

module.exports = { redactSensitive };
