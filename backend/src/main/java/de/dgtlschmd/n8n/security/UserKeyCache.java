package de.dgtlschmd.n8n.security;

import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class UserKeyCache {
    private final Map<String, SecretKey> tenantKeys = new ConcurrentHashMap<>();

    public void putKey(String tenantId, SecretKey key) {
        tenantKeys.put(tenantId, key);
    }

    public SecretKey getKey(String tenantId) {
        return tenantKeys.get(tenantId);
    }

    public void removeKey(String tenantId) {
        tenantKeys.remove(tenantId);
    }
}