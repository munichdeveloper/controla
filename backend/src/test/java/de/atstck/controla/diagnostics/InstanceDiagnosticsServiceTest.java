package de.atstck.controla.diagnostics;

import de.atstck.controla.instance.Instance;
import de.atstck.controla.instance.InstanceCredentialService;
import de.atstck.controla.instance.InstanceRepository;
import de.atstck.controla.security.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InstanceDiagnosticsServiceTest {

    private final InstanceRepository repository = mock(InstanceRepository.class);
    private final InstanceCredentialService credentials = mock(InstanceCredentialService.class);
    private final Instance instance = new Instance();

    @BeforeEach
    void setUp() {
        instance.setId(7L);
        instance.setExternalId("inst_1");
        instance.setTenantId("tenant-a");
        instance.setBaseUrl("https://n8n.example.com");
        TenantContext.setTenantId("tenant-a");
        when(repository.findByExternalIdAndTenantId("inst_1", "tenant-a")).thenReturn(Optional.of(instance));
        when(credentials.getDecryptedApiKey(instance)).thenReturn("api-key");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private InstanceDiagnosticsService service(List<DiagnosticCheck> checks, List<DiagnosticConclusionProvider> providers) {
        return new InstanceDiagnosticsService(repository, credentials, checks, providers,
                Duration.ofMillis(300), Duration.ofSeconds(2), Duration.ofSeconds(10),
                Clock.fixed(Instant.parse("2026-10-14T12:00:00Z"), ZoneOffset.UTC));
    }

    static DiagnosticCheck check(String id, DiagnosticCategory category, int order, CheckBody body) {
        return new DiagnosticCheck() {
            public String id() { return id; }
            public DiagnosticCategory category() { return category; }
            public String title() { return id; }
            public int order() { return order; }
            public DiagnosticResult run(DiagnosticContext context) throws Exception { return body.run(this, context); }
        };
    }

    interface CheckBody {
        DiagnosticResult run(DiagnosticCheck self, DiagnosticContext context) throws Exception;
    }

    @Test
    void isolatesExceptionsAndTimeoutsAsErrorResults() {
        DiagnosticCheck ok = check("a.ok", DiagnosticCategory.N8N, 1, (self, ctx) -> DiagnosticResult.of(self).ok("fine"));
        DiagnosticCheck throwing = check("a.throws", DiagnosticCategory.N8N, 2, (self, ctx) -> {
            throw new IllegalStateException("boom");
        });
        DiagnosticCheck slow = check("a.slow", DiagnosticCategory.N8N, 3, (self, ctx) -> {
            Thread.sleep(5000);
            return DiagnosticResult.of(self).ok("late");
        });

        DiagnosticReportDto report = service(List.of(ok, throwing, slow), List.of()).runForCurrentTenant("inst_1");

        assertThat(report.checks()).extracting(DiagnosticResult::id).containsExactly("a.ok", "a.throws", "a.slow");
        assertThat(report.checks()).extracting(DiagnosticResult::status)
                .containsExactly(DiagnosticStatus.OK, DiagnosticStatus.ERROR, DiagnosticStatus.ERROR);
        assertThat(report.checks().get(1).summary()).contains("boom");
        assertThat(report.checks().get(2).summary()).contains("Zeitüberschreitung");
        assertThat(report.checks().get(2).incomplete()).isTrue();
        assertThat(report.checks().get(1).incomplete()).isFalse();
        assertThat(report.overallStatus()).isEqualTo(DiagnosticStatus.ERROR);
    }

    @Test
    void timeoutDoesNotSetOverallStatusAndMarksReportIncomplete() {
        DiagnosticCheck ok = check("i.ok", DiagnosticCategory.N8N, 1, (self, ctx) -> DiagnosticResult.of(self).ok("fine"));
        DiagnosticCheck slow = check("i.slow", DiagnosticCategory.N8N, 2, (self, ctx) -> {
            Thread.sleep(5000);
            return DiagnosticResult.of(self).ok("late");
        });

        DiagnosticReportDto report = service(List.of(ok, slow), List.of()).runForCurrentTenant("inst_1");

        assertThat(report.overallStatus()).isEqualTo(DiagnosticStatus.OK);
        assertThat(report.incomplete()).isTrue();
        assertThat(report.incompleteChecks()).isEqualTo(1);
        assertThat(report.checks().get(1).incomplete()).isTrue();
    }

    @Test
    void failFindingPlusTimeoutYieldsFailAndIncomplete() {
        DiagnosticCheck failing = check("f.fail", DiagnosticCategory.N8N, 1, (self, ctx) -> DiagnosticResult.of(self).fail("down"));
        DiagnosticCheck slow = check("f.slow", DiagnosticCategory.N8N, 2, (self, ctx) -> {
            Thread.sleep(5000);
            return DiagnosticResult.of(self).ok("late");
        });

        DiagnosticReportDto report = service(List.of(failing, slow), List.of()).runForCurrentTenant("inst_1");

        assertThat(report.overallStatus()).isEqualTo(DiagnosticStatus.FAIL);
        assertThat(report.incomplete()).isTrue();
        assertThat(report.checks()).filteredOn(DiagnosticResult::incomplete).extracting(DiagnosticResult::id)
                .containsExactly("f.slow");
    }

    @Test
    void sortsByCategoryThenOrderAndOmitsChecksThatDoNotApply() {
        DiagnosticCheck n8n = check("n8n.x", DiagnosticCategory.N8N, 1, (self, ctx) -> DiagnosticResult.of(self).ok("ok"));
        DiagnosticCheck connectivity2 = check("conn.b", DiagnosticCategory.CONNECTIVITY, 20, (self, ctx) -> DiagnosticResult.of(self).warn("slow"));
        DiagnosticCheck connectivity1 = check("conn.a", DiagnosticCategory.CONNECTIVITY, 10, (self, ctx) -> DiagnosticResult.of(self).skipped("n/a"));
        DiagnosticCheck notApplicable = new DiagnosticCheck() {
            public String id() { return "never"; }
            public DiagnosticCategory category() { return DiagnosticCategory.HOST; }
            public String title() { return "never"; }
            public boolean appliesTo(DiagnosticContext context) { return false; }
            public DiagnosticResult run(DiagnosticContext context) { throw new AssertionError("must not run"); }
        };

        DiagnosticReportDto report = service(List.of(n8n, connectivity2, notApplicable, connectivity1), List.of())
                .runForCurrentTenant("inst_1");

        assertThat(report.checks()).extracting(DiagnosticResult::id).containsExactly("conn.a", "conn.b", "n8n.x");
        assertThat(report.overallStatus()).isEqualTo(DiagnosticStatus.WARN);
        assertThat(report.instanceId()).isEqualTo("inst_1");
        assertThat(report.generatedAt()).isEqualTo(Instant.parse("2026-10-14T12:00:00Z"));
    }

    @Test
    void propagatesTenantAndSharesValuesBetweenChecks() {
        AtomicReference<String> seenTenant = new AtomicReference<>();
        AtomicInteger loads = new AtomicInteger();
        DiagnosticCheck first = check("s.one", DiagnosticCategory.CONTAINER, 1, (self, ctx) -> {
            seenTenant.set(TenantContext.getTenantId());
            return DiagnosticResult.of(self).ok(ctx.shared("inspect", () -> "v" + loads.incrementAndGet()));
        });
        DiagnosticCheck second = check("s.two", DiagnosticCategory.CONTAINER, 2, (self, ctx) ->
                DiagnosticResult.of(self).ok(ctx.shared("inspect", () -> "v" + loads.incrementAndGet()) + "/" + ctx.apiKey()));

        DiagnosticReportDto report = service(List.of(first, second), List.of()).runForCurrentTenant("inst_1");

        assertThat(seenTenant.get()).isEqualTo("tenant-a");
        assertThat(loads.get()).isEqualTo(1);
        assertThat(report.checks()).extracting(DiagnosticResult::summary).containsExactly("v1", "v1/api-key");
    }

    @Test
    void addsConclusionsAndIgnoresFailingProviders() {
        DiagnosticCheck failing = check("x.fail", DiagnosticCategory.N8N, 1, (self, ctx) -> DiagnosticResult.of(self).fail("down"));
        DiagnosticConclusionProvider provider = (ctx, results) -> List.of(
                new DiagnosticConclusion("c1", DiagnosticStatus.FAIL, "Title", "Because", List.of("x.fail")));
        DiagnosticConclusionProvider broken = (ctx, results) -> {
            throw new IllegalStateException("broken");
        };

        DiagnosticReportDto report = service(List.of(failing), List.of(broken, provider)).runForCurrentTenant("inst_1");

        assertThat(report.conclusions()).extracting(DiagnosticConclusion::id).containsExactly("c1");
    }

    @Test
    void cachesReportsPerInstanceForAShortTime() {
        AtomicInteger runs = new AtomicInteger();
        DiagnosticCheck counting = check("c.count", DiagnosticCategory.N8N, 1, (self, ctx) ->
                DiagnosticResult.of(self).ok("run " + runs.incrementAndGet()));
        InstanceDiagnosticsService service = service(List.of(counting), List.of());

        service.runForCurrentTenant("inst_1");
        service.runForCurrentTenant("inst_1");

        assertThat(runs.get()).isEqualTo(1);
    }

    @Test
    void checkTimeoutCountsFromTheStartOfEachCheck() {
        DiagnosticCheck first = check("t.first", DiagnosticCategory.N8N, 1, (self, ctx) -> {
            Thread.sleep(250);
            return DiagnosticResult.of(self).ok("in time");
        });
        DiagnosticCheck overrunning = check("t.overrun", DiagnosticCategory.N8N, 2, (self, ctx) -> {
            Thread.sleep(500);
            return DiagnosticResult.of(self).ok("too late");
        });

        DiagnosticReportDto report = service(List.of(first, overrunning), List.of()).runForCurrentTenant("inst_1");

        assertThat(report.checks()).extracting(DiagnosticResult::status)
                .containsExactly(DiagnosticStatus.OK, DiagnosticStatus.ERROR);
    }

    @Test
    void queuedChecksGetTheirFullTimeout() {
        // More checks than pool threads: the ninth starts only after one of the first eight is done.
        List<DiagnosticCheck> checks = new java.util.ArrayList<>();
        for (int i = 0; i < 9; i++) {
            checks.add(check("q." + i, DiagnosticCategory.N8N, i, (self, ctx) -> {
                Thread.sleep(200);
                return DiagnosticResult.of(self).ok("done");
            }));
        }

        DiagnosticReportDto report = service(checks, List.of()).runForCurrentTenant("inst_1");

        assertThat(report.checks()).extracting(DiagnosticResult::status).containsOnly(DiagnosticStatus.OK);
    }

    @Test
    void totalTimeoutAlsoBoundsConclusionProviders() {
        DiagnosticCheck ok = check("p.ok", DiagnosticCategory.N8N, 1, (self, ctx) -> DiagnosticResult.of(self).ok("fine"));
        DiagnosticConclusionProvider blocking = (ctx, results) -> {
            try {
                Thread.sleep(10_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return List.of(new DiagnosticConclusion("late", DiagnosticStatus.FAIL, "Late", "", List.of()));
        };

        long started = System.nanoTime();
        DiagnosticReportDto report = service(List.of(ok), List.of(blocking)).runForCurrentTenant("inst_1");

        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofSeconds(5));
        assertThat(report.conclusions()).isEmpty();
    }

    @Test
    void overallStatusIncludesConclusionSeverity() {
        DiagnosticCheck warn = check("o.warn", DiagnosticCategory.N8N, 1, (self, ctx) -> DiagnosticResult.of(self).warn("meh"));
        DiagnosticConclusionProvider provider = (ctx, results) -> List.of(
                new DiagnosticConclusion("c.fail", DiagnosticStatus.FAIL, "Combined", "Two warnings add up", List.of("o.warn")));

        DiagnosticReportDto report = service(List.of(warn), List.of(provider)).runForCurrentTenant("inst_1");

        assertThat(report.overallStatus()).isEqualTo(DiagnosticStatus.FAIL);
    }

    @Test
    void rejectsInstancesOfOtherTenants() {
        TenantContext.setTenantId("tenant-b");
        when(repository.findByExternalIdAndTenantId("inst_1", "tenant-b")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service(List.of(), List.of()).runForCurrentTenant("inst_1"))
                .isInstanceOf(NoSuchElementException.class);
    }
}
