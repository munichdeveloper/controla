package de.atstck.controla.diagnostics;

import de.atstck.controla.instance.Instance;
import de.atstck.controla.instance.InstanceCredentialService;
import de.atstck.controla.instance.InstanceRepository;
import de.atstck.controla.security.TenantContext;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Runs all {@link DiagnosticCheck} beans for an instance in parallel and
 * collects their results plus the conclusions of all
 * {@link DiagnosticConclusionProvider}s into one report.
 */
@Service
public class InstanceDiagnosticsService {

    private static final Logger logger = LoggerFactory.getLogger(InstanceDiagnosticsService.class);

    private final InstanceRepository instanceRepository;
    private final InstanceCredentialService credentialService;
    private final List<DiagnosticCheck> checks;
    private final List<DiagnosticConclusionProvider> conclusionProviders;
    private final Duration checkTimeout;
    private final Duration totalTimeout;
    private final Duration cacheTtl;
    private final Clock clock;
    private final ExecutorService executor;
    private final Map<String, CachedReport> cache = new ConcurrentHashMap<>();

    @Autowired
    public InstanceDiagnosticsService(InstanceRepository instanceRepository,
                                      InstanceCredentialService credentialService,
                                      List<DiagnosticCheck> checks,
                                      List<DiagnosticConclusionProvider> conclusionProviders,
                                      @Value("${controla.diagnostics.check-timeout-ms:10000}") long checkTimeoutMs,
                                      @Value("${controla.diagnostics.total-timeout-ms:20000}") long totalTimeoutMs,
                                      @Value("${controla.diagnostics.cache-ttl-ms:10000}") long cacheTtlMs) {
        this(instanceRepository, credentialService, checks, conclusionProviders,
                Duration.ofMillis(checkTimeoutMs), Duration.ofMillis(totalTimeoutMs), Duration.ofMillis(cacheTtlMs),
                Clock.systemUTC());
    }

    InstanceDiagnosticsService(InstanceRepository instanceRepository,
                               InstanceCredentialService credentialService,
                               List<DiagnosticCheck> checks,
                               List<DiagnosticConclusionProvider> conclusionProviders,
                               Duration checkTimeout, Duration totalTimeout, Duration cacheTtl, Clock clock) {
        this.instanceRepository = instanceRepository;
        this.credentialService = credentialService;
        this.checks = List.copyOf(checks);
        this.conclusionProviders = List.copyOf(conclusionProviders);
        this.checkTimeout = checkTimeout;
        this.totalTimeout = totalTimeout;
        this.cacheTtl = cacheTtl;
        this.clock = clock;
        AtomicInteger threadNumber = new AtomicInteger();
        this.executor = Executors.newFixedThreadPool(8, runnable -> {
            Thread thread = new Thread(runnable, "diagnostics-" + threadNumber.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }

    /**
     * Report for an instance of the current tenant; results are cached for a
     * few seconds so repeated clicks do not hammer n8n.
     *
     * @throws NoSuchElementException if the instance does not exist for the current tenant
     */
    public DiagnosticReportDto runForCurrentTenant(String externalId) {
        String tenantId = TenantContext.getTenantId();
        Instance instance = instanceRepository.findByExternalIdAndTenantId(externalId, tenantId)
                .orElseThrow(() -> new NoSuchElementException("Instance not found: " + externalId));

        String cacheKey = tenantId + "/" + externalId;
        CachedReport cached = cache.get(cacheKey);
        Instant now = clock.instant();
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.report();
        }
        DiagnosticReportDto report = run(instance, tenantId);
        cache.put(cacheKey, new CachedReport(report, now.plus(cacheTtl)));
        return report;
    }

    /** Runs the report without cache; the tenant must match the instance (callers check ownership). */
    public DiagnosticReportDto run(Instance instance, String tenantId) {
        Instant startedAt = clock.instant();
        long started = System.nanoTime();
        DiagnosticContext context = new DiagnosticContext(
                instance, () -> credentialService.getDecryptedApiKey(instance), tenantId, startedAt);

        List<DiagnosticCheck> applicable = new ArrayList<>();
        for (DiagnosticCheck check : checks) {
            try {
                if (check.appliesTo(context)) {
                    applicable.add(check);
                }
            } catch (RuntimeException e) {
                logger.warn("appliesTo failed for check {}: {}", check.id(), e.getMessage());
            }
        }

        List<Future<DiagnosticResult>> futures = new ArrayList<>();
        for (DiagnosticCheck check : applicable) {
            futures.add(executor.submit(() -> runCheck(check, context, tenantId)));
        }

        long deadline = System.nanoTime() + totalTimeout.toNanos();
        List<DiagnosticResult> results = new ArrayList<>();
        for (int i = 0; i < applicable.size(); i++) {
            DiagnosticCheck check = applicable.get(i);
            Future<DiagnosticResult> future = futures.get(i);
            long remaining = Math.max(0, deadline - System.nanoTime());
            long wait = Math.min(checkTimeout.toNanos(), remaining);
            try {
                results.add(future.get(wait, TimeUnit.NANOSECONDS));
            } catch (TimeoutException e) {
                future.cancel(true);
                results.add(DiagnosticResult.of(check)
                        .error("Zeitüberschreitung: Die Prüfung hat nicht rechtzeitig geantwortet.")
                        .withDuration(TimeUnit.NANOSECONDS.toMillis(wait)));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.cancel(true);
                results.add(DiagnosticResult.of(check).error("Prüfung abgebrochen."));
            } catch (Exception e) {
                results.add(DiagnosticResult.of(check).error("Prüfung fehlgeschlagen: " + e.getMessage()));
            }
        }

        results.sort(Comparator
                .comparing(DiagnosticResult::category)
                .thenComparing(r -> orderOf(r.id(), applicable)));

        List<DiagnosticConclusion> conclusions = new ArrayList<>();
        for (DiagnosticConclusionProvider provider : conclusionProviders) {
            try {
                conclusions.addAll(provider.conclude(context, results));
            } catch (RuntimeException e) {
                logger.warn("Conclusion provider {} failed: {}", provider.getClass().getSimpleName(), e.getMessage());
            }
        }

        DiagnosticStatus overall = results.stream()
                .map(DiagnosticResult::status)
                .filter(s -> s != DiagnosticStatus.SKIPPED)
                .max(Comparator.naturalOrder())
                .orElse(DiagnosticStatus.OK);

        long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
        logger.info("Diagnostics finished: tenantId={}, instanceId={}, checks={}, overall={}, durationMs={}",
                tenantId, instance.getExternalId(), results.size(), overall, durationMs);
        return new DiagnosticReportDto(instance.getExternalId(), startedAt, durationMs, overall, conclusions, results);
    }

    private DiagnosticResult runCheck(DiagnosticCheck check, DiagnosticContext context, String tenantId) {
        TenantContext.setTenantId(tenantId);
        long started = System.nanoTime();
        try {
            DiagnosticResult result = check.run(context);
            return result.withDuration(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
        } catch (Exception e) {
            logger.warn("Diagnostic check {} failed for instance {}: {}", check.id(), context.externalId(), e.toString());
            return DiagnosticResult.of(check)
                    .error("Prüfung fehlgeschlagen: " + e.getMessage())
                    .withDuration(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
        } finally {
            TenantContext.clear();
        }
    }

    private static int orderOf(String id, List<DiagnosticCheck> checks) {
        return checks.stream().filter(c -> c.id().equals(id)).findFirst().map(DiagnosticCheck::order).orElse(Integer.MAX_VALUE);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    private record CachedReport(DiagnosticReportDto report, Instant expiresAt) {
    }
}
