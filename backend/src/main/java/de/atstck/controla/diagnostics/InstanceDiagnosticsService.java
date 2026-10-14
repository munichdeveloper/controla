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
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

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
        Instant finished = clock.instant();
        cache.values().removeIf(entry -> !entry.expiresAt().isAfter(finished));
        cache.put(cacheKey, new CachedReport(report, finished.plus(cacheTtl)));
        return report;
    }

    /**
     * Runs the report without cache; the tenant must match the instance (callers check ownership).
     * Each check gets at most {@code checkTimeout} from the moment it starts; the whole run,
     * including {@code appliesTo} and the conclusion providers, is bounded by {@code totalTimeout}.
     */
    public DiagnosticReportDto run(Instance instance, String tenantId) {
        Instant startedAt = clock.instant();
        long started = System.nanoTime();
        long deadline = started + totalTimeout.toNanos();
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

        List<DiagnosticResult> results = runChecks(applicable, context, tenantId, deadline);
        results.sort(Comparator
                .comparing(DiagnosticResult::category)
                .thenComparing(r -> orderOf(r.id(), applicable)));

        List<DiagnosticConclusion> conclusions = runConclusionProviders(context, results, tenantId, deadline);

        DiagnosticStatus overall = Stream.concat(
                        results.stream().map(DiagnosticResult::status),
                        conclusions.stream().map(DiagnosticConclusion::severity))
                .filter(s -> s != null && s != DiagnosticStatus.SKIPPED)
                .max(Comparator.naturalOrder())
                .orElse(DiagnosticStatus.OK);

        long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
        logger.info("Diagnostics finished: tenantId={}, instanceId={}, checks={}, overall={}, durationMs={}",
                tenantId, instance.getExternalId(), results.size(), overall, durationMs);
        return new DiagnosticReportDto(instance.getExternalId(), startedAt, durationMs, overall, conclusions, results);
    }

    private List<DiagnosticResult> runChecks(List<DiagnosticCheck> applicable, DiagnosticContext context,
                                             String tenantId, long deadline) {
        int count = applicable.size();
        long checkTimeoutNanos = checkTimeout.toNanos();
        long[] startedAt = new long[count];
        boolean[] running = new boolean[count];
        DiagnosticResult[] results = new DiagnosticResult[count];
        // Indices of checks that started or finished; wakes the waiting loop.
        BlockingQueue<Integer> events = new LinkedBlockingQueue<>();
        List<Future<DiagnosticResult>> futures = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            int index = i;
            DiagnosticCheck check = applicable.get(i);
            FutureTask<DiagnosticResult> task = new FutureTask<>(() -> {
                events.add(index);
                return runCheck(check, context, tenantId);
            }) {
                @Override
                protected void done() {
                    events.add(index);
                }
            };
            futures.add(task);
            executor.execute(task);
        }

        int pending = count;
        while (pending > 0) {
            long now = System.nanoTime();
            long nextWake = deadline;
            for (int i = 0; i < count; i++) {
                if (results[i] != null) {
                    continue;
                }
                Future<DiagnosticResult> future = futures.get(i);
                DiagnosticCheck check = applicable.get(i);
                if (future.isDone()) {
                    results[i] = completed(check, future);
                    pending--;
                    continue;
                }
                long checkDeadline = running[i] ? startedAt[i] + checkTimeoutNanos : deadline;
                if (now - deadline >= 0 || now - checkDeadline >= 0) {
                    future.cancel(true);
                    long ranFor = running[i] ? now - startedAt[i] : 0;
                    results[i] = DiagnosticResult.of(check)
                            .error("Zeitüberschreitung: Die Prüfung hat nicht rechtzeitig geantwortet.")
                            .withDuration(TimeUnit.NANOSECONDS.toMillis(ranFor));
                    pending--;
                    continue;
                }
                if (checkDeadline - nextWake < 0) {
                    nextWake = checkDeadline;
                }
            }
            if (pending == 0) {
                break;
            }
            try {
                Integer event = events.poll(Math.max(0, nextWake - System.nanoTime()), TimeUnit.NANOSECONDS);
                for (; event != null; event = events.poll()) {
                    if (!running[event]) {
                        running[event] = true;
                        startedAt[event] = System.nanoTime();
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                for (int i = 0; i < count; i++) {
                    if (results[i] == null) {
                        futures.get(i).cancel(true);
                        results[i] = DiagnosticResult.of(applicable.get(i)).error("Prüfung abgebrochen.");
                    }
                }
                break;
            }
        }
        return new ArrayList<>(List.of(results));
    }

    private static DiagnosticResult completed(DiagnosticCheck check, Future<DiagnosticResult> future) {
        try {
            return future.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return DiagnosticResult.of(check).error("Prüfung abgebrochen.");
        } catch (Exception e) {
            return DiagnosticResult.of(check).error("Prüfung fehlgeschlagen: " + e.getMessage());
        }
    }

    private List<DiagnosticConclusion> runConclusionProviders(DiagnosticContext context, List<DiagnosticResult> results,
                                                              String tenantId, long deadline) {
        List<DiagnosticResult> view = List.copyOf(results);
        List<Future<List<DiagnosticConclusion>>> futures = new ArrayList<>();
        for (DiagnosticConclusionProvider provider : conclusionProviders) {
            futures.add(executor.submit(() -> {
                TenantContext.setTenantId(tenantId);
                try {
                    return provider.conclude(context, view);
                } finally {
                    TenantContext.clear();
                }
            }));
        }
        List<DiagnosticConclusion> conclusions = new ArrayList<>();
        for (int i = 0; i < futures.size(); i++) {
            String name = conclusionProviders.get(i).getClass().getSimpleName();
            Future<List<DiagnosticConclusion>> future = futures.get(i);
            try {
                List<DiagnosticConclusion> provided =
                        future.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
                if (provided != null) {
                    conclusions.addAll(provided);
                }
            } catch (TimeoutException e) {
                future.cancel(true);
                logger.warn("Conclusion provider {} timed out", name);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.cancel(true);
            } catch (Exception e) {
                logger.warn("Conclusion provider {} failed: {}", name, e.getMessage());
            }
        }
        return conclusions;
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
