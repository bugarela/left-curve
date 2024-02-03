import * as crypto from "crypto";
import * as fs from "fs";
import {
  Bip39,
  EnglishMnemonic,
  Secp256k1,
  Secp256k1Keypair,
  Sha256,
  Slip10,
  Slip10Curve,
  stringToPath,
} from "@cosmjs/crypto";
import {
  encodeBase64,
  encodeBigEndian32,
  encodeUtf8,
  decodeBase64,
  decodeHex,
  serialize,
} from "./serde";
import { Message, Tx } from "./types";

// parameters for keystore encryption
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_SALT_LEN = 16;
const PBKDF2_KEY_LEN = 32;
const PBKDF2_DIGEST = "sha256";
const AES_ALGORITHM = "aes-256-gcm";
const AES_NONCE_LEN = 12;

/**
 * The JSON keystore file generated by cwcli.
 */
export type Keystore = {
  pk: string;
  salt: string;
  nonce: string;
  ciphertext: string;
};

/**
 * An secp256k1 private key, with useful methods.
 */
export class SigningKey {
  private keyPair: Secp256k1Keypair;

  /**
   * Do not use; use `fromMnemonic` or `fromFile` instead.
   */
  private constructor(keyPair: Secp256k1Keypair) {
    this.keyPair = keyPair;
  }

  /**
   * Derive an secp256k1 private key pair from the given English mnemonic and
   * BIP-44 coin type.
   */
  public static async fromMnemonic(mnemonic: string, coinType = 60): Promise<SigningKey> {
    const englishMnemonic = new EnglishMnemonic(mnemonic);
    const seed = await Bip39.mnemonicToSeed(englishMnemonic);
    const hdPath = stringToPath(`m/44'/${coinType}'/0'/0/0`);
    const slip10Res = Slip10.derivePath(Slip10Curve.Secp256k1, seed, hdPath);
    const keyPair = await Secp256k1.makeKeypair(slip10Res.privkey);
    return new SigningKey(keyPair);
  }

  /**
   * Read an decrypt a keystore file.
   */
  public static async fromFile(filename: string, password: string): Promise<SigningKey> {
    // read keystore file
    const keystoreStr = fs.readFileSync(filename, { encoding: "utf8" });
    const { salt, nonce, ciphertext } = JSON.parse(keystoreStr) as Keystore;

    // recover encryption key from password and salt
    const passwordHash = crypto.pbkdf2Sync(
      encodeUtf8(password),
      decodeBase64(salt),
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LEN,
      PBKDF2_DIGEST,
    );

    // decrypt the private key
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, passwordHash, decodeBase64(nonce));
    const decrypted = decipher.update(decodeBase64(ciphertext));
    const privkey = decrypted.subarray(0, decrypted.length - 16); // crop the AES auth tag

    return new SigningKey(await Secp256k1.makeKeypair(privkey));
  }

  /**
   * Encrypt a key and save it to a file.
   */
  public writeToFile(filename: string, password: string) {
    // generate encryption key
    const salt = generateRandomBytes(PBKDF2_SALT_LEN);
    const passwordHash = crypto.pbkdf2Sync(
      encodeUtf8(password),
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LEN,
      PBKDF2_DIGEST,
    );

    // encrypt the private key
    const nonce = generateRandomBytes(AES_NONCE_LEN);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, passwordHash, nonce);
    const ciphertext = cipher.update(this.privKey());

    // write keystore to file
    const keystore = {
      pk: encodeBase64(this.pubKey()),
      salt: encodeBase64(salt),
      nonce: encodeBase64(nonce),
      ciphertext: encodeBase64(ciphertext),
    };
    fs.writeFileSync(filename, JSON.stringify(keystore, null, 2));
  }

  /**
   * Create and sign a transaction.
   */
  public async createAndSignTx(
    msgs: Message[],
    sender: string,
    chainId: string,
    sequence: number,
  ): Promise<Tx> {
    const signBytes = createSignBytes(msgs, sender, chainId, sequence);
    const extendedSignature = await Secp256k1.createSignature(signBytes, this.keyPair.privkey);
    // important: trim the recovery byte to get the 64-byte signature
    const signature = Secp256k1.trimRecoveryByte(extendedSignature.toFixedLength());
    return {
      sender,
      msgs,
      credential: encodeBase64(signature),
    };
  }

  public privKey(): Uint8Array {
    return this.keyPair.privkey;
  }

  public pubKey(): Uint8Array {
    // important: get the compressed 32-byte pubkey instead of the 64-byte one
    return Secp256k1.compressPubkey(this.keyPair.pubkey);
  }
}

/**
 * Generate sign byte that the cw-account contract expects.
 */
export function createSignBytes(
  msgs: Message[],
  sender: string,
  chainId: string,
  sequence: number,
): Uint8Array {
  const hasher = new Sha256();
  hasher.update(encodeUtf8(serialize(msgs)));
  hasher.update(decodeHex(sender.slice(2)));
  hasher.update(encodeUtf8(chainId));
  hasher.update(encodeBigEndian32(sequence));
  return hasher.digest();
}

function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.randomFillSync(bytes);
  return bytes;
}