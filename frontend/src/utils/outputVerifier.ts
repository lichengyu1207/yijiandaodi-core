export interface VerifyResult {
  valid: boolean;
  signature: string;
  timestamp: number;
  tampered: boolean;
}

export function signOutput(data: string, secret: string = 'yijiandaodi-ass-v1'): string {
  const timestamp = Date.now();
  const content = `${data}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${hash.toString(16)}-${timestamp}`;
}

export function verifyOutput(data: string, signature: string, maxAge: number = 300000): VerifyResult {
  try {
    const parts = signature.split('-');
    const hashPart = parts.slice(0, -1).join('-');
    const timestamp = parseInt(parts[parts.length - 1], 16);

    if (isNaN(timestamp)) return { valid: false, signature, timestamp: 0, tampered: true };

    if (Date.now() - timestamp > maxAge) {
      return { valid: false, signature, timestamp, tampered: false };
    }

    const expectedSign = signOutput(data);
    const valid = expectedSign === signature;

    return { valid, signature, timestamp, tampered: !valid };
  } catch {
    return { valid: false, signature: '', timestamp: 0, tampered: true };
  }
}
