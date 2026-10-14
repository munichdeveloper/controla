package de.atstck.controla.instance;

import de.atstck.controla.security.CryptoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Decrypts the stored n8n API key of an instance. */
@Service
public class InstanceCredentialService {

    private static final Logger logger = LoggerFactory.getLogger(InstanceCredentialService.class);

    private final CryptoService cryptoService;

    public InstanceCredentialService(CryptoService cryptoService) {
        this.cryptoService = cryptoService;
    }

    public String getDecryptedApiKey(Instance instance) {
        try {
            return cryptoService.decrypt(instance.getApiKey(), cryptoService.getMasterKey());
        } catch (Exception e) {
            logger.warn("API key decryption failed, using stored value as fallback: tenantId={}, instanceId={}, instanceName={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), e);
            // Fallback: If decryption fails (e.g. legacy plaintext key or old user key), return raw key
            // This allows migration or re-entry of keys
            return instance.getApiKey();
        }
    }
}
