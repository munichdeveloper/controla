package de.atstck.controla.security;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import javax.crypto.*;
import javax.crypto.spec.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;

class CryptoServiceTest {
    private CryptoService service() {
        var service = new CryptoService();
        ReflectionTestUtils.setField(service, "masterKeyString", UUID.randomUUID().toString());
        service.init();
        return service;
    }

    @Test
    void roundtripUsesFreshSaltAndIvAndRejectsTampering() {
        var service = service();
        SecretKey key = service.getMasterKey();
        String plain = "Unicode äöü 🔐";
        String encrypted = service.encrypt(plain, key);
        assertThat(encrypted).startsWith("v1:");
        assertThat(service.decrypt(encrypted, key)).isEqualTo(plain);
        assertThat(service.encrypt(plain, key)).isNotEqualTo(encrypted);
        for (int offset : new int[]{0, 16, 28, 44}) {
            byte[] bytes = Base64.getDecoder().decode(encrypted.substring(3));
            bytes[offset] ^= 1;
            String changed = "v1:" + Base64.getEncoder().encodeToString(bytes);
            assertThatThrownBy(() -> service.decrypt(changed, key)).isInstanceOf(RuntimeException.class);
        }
        assertThatThrownBy(() -> service.decrypt(encrypted, service().getMasterKey())).isInstanceOf(RuntimeException.class);
        for (String invalid : List.of("v1:", "v2:" + encrypted.substring(3), "v1:invalid")) {
            assertThatThrownBy(() -> service.decrypt(invalid, key)).isInstanceOf(RuntimeException.class);
        }
        assertThat(service.decrypt(service.encrypt("", key), key)).isEmpty();
        SecretKey userKey = service.deriveKey(UUID.randomUUID().toString(), service.generateSalt());
        assertThat(service.decrypt(service.encrypt(plain, userKey), userKey)).isEqualTo(plain);
    }

    @Test
    void legacyRecordsRemainReadableAndAreRewrittenWithNewFormat() throws Exception {
        var service = service();
        String material = (String) ReflectionTestUtils.getField(service, "masterKeyString");
        SecretKey legacyKey = new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(new PBEKeySpec(material.toCharArray(), "FixedSaltForMasterKey".getBytes(StandardCharsets.UTF_8), 65536, 256))
                .getEncoded(), "AES");
        Cipher legacy = Cipher.getInstance("AES/ECB/PKCS5Padding");
        legacy.init(Cipher.ENCRYPT_MODE, legacyKey);
        String old = Base64.getEncoder().encodeToString(legacy.doFinal("legacy record".getBytes(StandardCharsets.UTF_8)));
        String plain = service.decrypt(old, service.getMasterKey());
        assertThat(plain).isEqualTo("legacy record");
        assertThat(service.encrypt(plain, service.getMasterKey())).startsWith("v1:");
    }
}
