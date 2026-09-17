/* RFC 6238 TOTP. No network, storage, or third-party runtime dependencies. */
(function (root) {
  'use strict';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function decodeBase32(value) {
    const normalized = value.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z2-7]+={0,6}$/.test(normalized)) throw new Error('密钥应为 Base32 格式，只包含字母 A–Z 和数字 2–7。');
    const raw = normalized.replace(/=+$/, '');
    const remainder = raw.length % 8;
    if (![0, 2, 4, 5, 7].includes(remainder) || (normalized.includes('=') && normalized.length % 8 !== 0)) throw new Error('密钥长度或末尾填充不正确，请检查是否复制完整。');
    let bits = 0, buffer = 0;
    const bytes = [];
    for (const char of raw) {
      buffer = (buffer << 5) | alphabet.indexOf(char);
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >>> bits) & 255);
        buffer &= (1 << bits) - 1;
      }
    }
    if (buffer !== 0) throw new Error('密钥末尾不完整，请重新复制。');
    if (bytes.length < 10) throw new Error('密钥过短，请输入完整的 2FA 密钥，而非一次性验证码。');
    return new Uint8Array(bytes);
  }
  function parse(value) {
    const text = value.trim();
    if (!text) throw new Error('请先输入密钥或配置链接。');
    if (text.length > 4096) throw new Error('输入内容过长，请检查密钥或配置链接。');
    let secret = text, algorithm = 'SHA-1', digits = 6, period = 30, label = '';
    if (/^otpauth:/i.test(text)) {
      let url;
      try { url = new URL(text); } catch { throw new Error('配置链接格式不正确。'); }
      if (url.hostname !== 'totp' || url.username || url.password || url.port || url.hash) throw new Error('仅支持 otpauth://totp/ 格式，不支持 HOTP。');
      for (const key of ['secret', 'algorithm', 'digits', 'period']) {
        if (url.searchParams.getAll(key).length > 1) throw new Error('配置链接包含重复参数，请检查链接。');
      }
      secret = url.searchParams.get('secret') || '';
      const hash = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
      if (!['SHA1', 'SHA256', 'SHA512'].includes(hash)) throw new Error('仅支持 SHA1、SHA256 和 SHA512 算法。');
      algorithm = hash.replace('SHA', 'SHA-');
      const digitText = url.searchParams.get('digits') || '6';
      if (!['6', '8'].includes(digitText)) throw new Error('仅支持 6 位或 8 位验证码。');
      digits = Number(digitText);
      const periodText = url.searchParams.get('period') || '30';
      if (!/^\d{1,5}$/.test(periodText) || Number(periodText) < 1 || Number(periodText) > 86400) throw new Error('验证码周期必须是 1–86400 秒的整数。');
      period = Number(periodText);
      try { label = decodeURIComponent(url.pathname.slice(1)); } catch { throw new Error('配置链接中的账号名称编码不正确。'); }
    }
    return { bytes: decodeBase32(secret), algorithm, digits, period, label };
  }
  async function prepare(value) {
    const config = parse(value);
    if (!root.crypto?.subtle) throw new Error('此浏览器不支持安全计算，请通过 HTTPS 使用新版浏览器。');
    try {
      const key = await root.crypto.subtle.importKey('raw', config.bytes, { name: 'HMAC', hash: config.algorithm }, false, ['sign']);
      return { key, algorithm: config.algorithm, digits: config.digits, period: config.period, label: config.label };
    } finally { config.bytes.fill(0); }
  }
  async function generate(config, time = Date.now()) {
    if (!Number.isFinite(time) || time < 0) throw new Error('设备时间不正确。');
    let counter = BigInt(Math.floor(time / 1000 / config.period));
    const message = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) { message[i] = Number(counter & 255n); counter >>= 8n; }
    const mac = new Uint8Array(await root.crypto.subtle.sign('HMAC', config.key, message));
    const offset = mac[mac.length - 1] & 15;
    const number = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
    return String(number % (10 ** config.digits)).padStart(config.digits, '0');
  }
  root.Totp = Object.freeze({ parse, prepare, generate });
})(globalThis);
