package de.atstck.controla.security;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import jakarta.annotation.PostConstruct;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;

@Service
public class CryptoService {

    @Value("${controla.security.master-key}")
    private String masterKeyString;

    private SecretKey masterKey;

    private static final String ALGORITHM = "AES";
    private static final int KEY_LENGTH = 256;
    private static final int ITERATIONS = 65536;

    @PostConstruct
    public void init() {
        // Preserve the original key derivation exclusively for legacy reads.
        String salt = Base64.getEncoder().encodeToString("FixedSaltForMasterKey".getBytes());
        this.masterKey = deriveKey(masterKeyString, salt);
    }

    public SecretKey getMasterKey() {
        return masterKey;
    }

    public String generateSalt() {
        SecureRandom random = new SecureRandom();
        byte[] salt = new byte[16];
        random.nextBytes(salt);
        return Base64.getEncoder().encodeToString(salt);
    }

    public SecretKey deriveKey(String password, String salt) {
        try {
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            KeySpec spec = new PBEKeySpec(password.toCharArray(), Base64.getDecoder().decode(salt), ITERATIONS, KEY_LENGTH);
            SecretKey tmp = factory.generateSecret(spec);
            return new SecretKeySpec(tmp.getEncoded(), ALGORITHM);
        } catch (Exception e) {
            throw new RuntimeException("Error deriving key", e);
        }
    }

    // New records carry their own random KDF salt and IV. The fixed-salt master
    // key above is retained only as the public legacy key handle for old records.
    private String keyMaterial(SecretKey key) {
        return masterKey != null && java.security.MessageDigest.isEqual(masterKey.getEncoded(), key.getEncoded())
                ? masterKeyString : Base64.getEncoder().encodeToString(key.getEncoded());
    }

    private SecretKey recordKey(String material, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(material.toCharArray(), salt, 210000, 256);
        try {
            return new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded(), "AES");
        } finally { spec.clearPassword(); }
    }

    public String encrypt(String data, SecretKey key) {
        try {
            byte[] salt = new byte[16];
            byte[] iv = new byte[12];
            SecureRandom random = new SecureRandom();
            random.nextBytes(salt);
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, recordKey(keyMaterial(key), salt), new javax.crypto.spec.GCMParameterSpec(128, iv));
            cipher.updateAAD("v1:".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            byte[] ciphertext = cipher.doFinal(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return "v1:" + Base64.getEncoder().encodeToString(java.nio.ByteBuffer
                    .allocate(28 + ciphertext.length).put(salt).put(iv).put(ciphertext).array());
        } catch (Exception e) {
            throw new RuntimeException("Error encrypting data", e);
        }
    }

    public String decrypt(String encryptedData, SecretKey key) {
        try {
            if (!encryptedData.startsWith("v1:")) {
                Cipher legacy = Cipher.getInstance("AES/ECB/PKCS5Padding");
                legacy.init(Cipher.DECRYPT_MODE, key);
                return new String(legacy.doFinal(Base64.getDecoder().decode(encryptedData)), java.nio.charset.Charset.defaultCharset());
            }
            byte[] payload = Base64.getDecoder().decode(encryptedData.substring(3));
            if (payload.length < 44) throw new IllegalArgumentException("Invalid encrypted record");
            var buffer = java.nio.ByteBuffer.wrap(payload);
            byte[] salt = new byte[16]; buffer.get(salt);
            byte[] iv = new byte[12]; buffer.get(iv);
            byte[] ciphertext = new byte[buffer.remaining()]; buffer.get(ciphertext);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, recordKey(keyMaterial(key), salt), new javax.crypto.spec.GCMParameterSpec(128, iv));
            cipher.updateAAD("v1:".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return new String(cipher.doFinal(ciphertext), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Error decrypting data", e);
        }
    }
}
