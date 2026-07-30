import * as crypto from 'node:crypto';

class CryptoService {
  async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });
      return { publicKey, privateKey };
    } catch (error) {
      throw new Error(`生成密钥对失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async encrypt(data: string, publicKeyPem: string): Promise<string> {
    try {
      const buffer = Buffer.from(data, 'utf-8');
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        buffer
      );
      return encrypted.toString('base64');
    } catch (error) {
      throw new Error(`加密失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async decrypt(ciphertext: string, privateKeyPem: string): Promise<string> {
    try {
      const buffer = Buffer.from(ciphertext, 'base64');
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        buffer
      );
      return decrypted.toString('utf-8');
    } catch (error) {
      throw new Error(`解密失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sign(data: string, privateKeyPem: string): Promise<string> {
    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(data);
      sign.end();
      const signature = sign.sign(privateKeyPem);
      return signature.toString('base64');
    } catch (error) {
      throw new Error(`签名失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async verify(data: string, signature: string, publicKeyPem: string): Promise<boolean> {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(publicKeyPem, Buffer.from(signature, 'base64'));
    } catch (error) {
      console.error(`验签异常: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

export default new CryptoService();
