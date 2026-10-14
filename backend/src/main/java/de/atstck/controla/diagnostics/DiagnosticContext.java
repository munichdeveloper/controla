package de.atstck.controla.diagnostics;

import de.atstck.controla.instance.Instance;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.function.Supplier;

/**
 * Everything a check needs about the instance under diagnosis. Checks of the
 * same run can share expensive lookups (e.g. one companion call for several
 * container checks) via {@link #shared(String, Supplier)}.
 */
public final class DiagnosticContext {

    private final Instance instance;
    private final Supplier<String> apiKeySupplier;
    private final String tenantId;
    private final Instant startedAt;
    private final Map<String, CompletableFuture<Object>> shared = new ConcurrentHashMap<>();
    private volatile String apiKey;

    public DiagnosticContext(Instance instance, Supplier<String> apiKeySupplier, String tenantId, Instant startedAt) {
        this.instance = instance;
        this.apiKeySupplier = apiKeySupplier;
        this.tenantId = tenantId;
        this.startedAt = startedAt;
    }

    public Instance instance() {
        return instance;
    }

    public Long instanceId() {
        return instance.getId();
    }

    public String externalId() {
        return instance.getExternalId();
    }

    public String baseUrl() {
        return instance.getBaseUrl();
    }

    public String tenantId() {
        return tenantId;
    }

    public Instant startedAt() {
        return startedAt;
    }

    /** Decrypted n8n API key (decrypted once per run, on first use). */
    public String apiKey() {
        String key = apiKey;
        if (key == null) {
            synchronized (this) {
                if (apiKey == null) {
                    apiKey = apiKeySupplier.get();
                }
                key = apiKey;
            }
        }
        return key;
    }

    /**
     * Loads a value once per run and shares it between checks; concurrent
     * callers wait for the same load. A failing loader rethrows its exception
     * to every caller.
     */
    @SuppressWarnings("unchecked")
    public <T> T shared(String key, Supplier<T> loader) {
        CompletableFuture<Object> created = new CompletableFuture<>();
        CompletableFuture<Object> existing = shared.putIfAbsent(key, created);
        if (existing == null) {
            try {
                created.complete(loader.get());
            } catch (RuntimeException e) {
                created.completeExceptionally(e);
            }
            existing = created;
        }
        try {
            return (T) existing.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for shared value " + key, e);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof RuntimeException runtime) {
                throw runtime;
            }
            throw new IllegalStateException(e.getCause());
        }
    }
}
