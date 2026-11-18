package de.atstck.controla.instance;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import de.atstck.controla.alerts.InstanceAlertHandler;
import de.atstck.controla.alerts.triage.*;
import de.atstck.controla.dto.EventDto;
import de.atstck.controla.license.LicenseService;
import de.atstck.controla.security.CryptoService;
import de.atstck.controla.service.CoreApiClient;
import de.atstck.controla.service.N8nApiClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static de.atstck.controla.alerts.triage.TriageDecision.Decision.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class InstanceServiceTriageTest {
    private final N8nApiClient n8n = mock(N8nApiClient.class);
    private final InstanceAlertHandler alerts = mock(InstanceAlertHandler.class);
    private final FailureTriageClassifier classifier = mock(FailureTriageClassifier.class);
    private final InstanceCredentialService credentials = mock(InstanceCredentialService.class);
    private final InstanceService service = new InstanceService(mock(CoreApiClient.class), mock(InstanceRepository.class),
            n8n, mock(CryptoService.class), mock(LicenseService.class), alerts, credentials);
    private final Instance instance = new Instance();
    private final Logger triageLogger = (Logger) LoggerFactory.getLogger(FailureTriageObserver.class);
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();

    @BeforeEach
    void setUp() {
        logs.start();
        triageLogger.addAppender(logs);
        instance.setExternalId("inst_test");
        instance.setTenantId("tenant1");
        instance.setName("PRIVATE instance name");
        instance.setBaseUrl("https://private.example");
        instance.setStatus("online");
        when(credentials.getDecryptedApiKey(instance)).thenReturn("PRIVATE_API_KEY");
        when(n8n.getSystemInfo(anyString(), anyString())).thenReturn(new N8nApiClient.SystemInfo("online", "1.0"));
    }

    @AfterEach
    void tearDown() {
        triageLogger.detachAppender(logs);
        logs.stop();
    }

    @Test
    void defaultOffDoesNotClassifyFetchHistoryOrLogTriage() {
        EventDto error = error("1", "wf1");
        when(n8n.getExecutionErrors(anyString(), anyString(), eq(50), any(Instant.class))).thenReturn(List.of(error));

        service.updateInstanceStatus(instance);

        verify(alerts).handleWorkflowError(instance, "PRIVATE workflow", "PRIVATE error message");
        verifyNoInteractions(classifier);
        verify(n8n, never()).fetchExecutionFailureCounts(anyString(), anyString(), any(Instant.class));
        assertThat(logs.list).isEmpty();
        assertThat(instance.getLastErrorCheck()).isNotNull();
    }

    @Test
    void everyDecisionStillForwardsAndLogsExactlyOnce() {
        List<EventDto> errors = List.of(error("1", "wf1"), error("2", "wf2"), error("3", "wf3"));
        when(n8n.getExecutionErrors(anyString(), anyString(), eq(50), any(Instant.class))).thenReturn(errors);
        when(n8n.fetchExecutionFailureCounts(anyString(), anyString(), any(Instant.class)))
                .thenReturn(Map.of("wf1", 1, "wf2", 3, "wf3", 1));
        List<TriageDecision> decisions = List.of(new TriageDecision(NOISE, 0.8, "transient_retry"),
                new TriageDecision(ALERT, 0.9, "repeated_workflow_failure"), TriageDecision.unsure("insufficient_evidence"));
        var remainingDecisions = decisions.iterator();
        when(classifier.classify(any())).thenAnswer(invocation -> {
            assertThat(instance.getLastErrorCheck()).isNotNull();
            return remainingDecisions.next();
        });
        service.configureFailureTriage(new FailureTriageObserver(classifier, n8n));

        service.updateInstanceStatus(instance);

        verify(alerts, times(3)).handleWorkflowError(instance, "PRIVATE workflow", "PRIVATE error message");
        ArgumentCaptor<FailureSignal> signals = ArgumentCaptor.forClass(FailureSignal.class);
        verify(classifier, times(3)).classify(signals.capture());
        assertThat(signals.getAllValues()).extracting(FailureSignal::failureCount24h).containsExactly(1, 3, 1);
        assertThat(logs.list).hasSize(3);
        assertThat(logs.list.get(0).getFormattedMessage()).contains("instanceId=inst_test", "workflowId=wf1",
                "decision=NOISE", "confidence=0.8", "reasonCode=transient_retry", "actualAction=forwarded_to_alert_handler");
        assertThat(logs.list.get(1).getFormattedMessage()).contains("workflowId=wf2", "decision=ALERT");
        assertThat(logs.list.get(2).getFormattedMessage()).contains("workflowId=wf3", "decision=UNSURE");
        assertThat(logs.list).allSatisfy(log -> assertThat(log.getFormattedMessage())
                .doesNotContain("PRIVATE", "https://"));
        var order = inOrder(alerts, n8n, classifier);
        order.verify(alerts, times(3)).handleWorkflowError(instance, "PRIVATE workflow", "PRIVATE error message");
        order.verify(n8n).fetchExecutionFailureCounts(anyString(), anyString(), any(Instant.class));
        order.verify(classifier, times(3)).classify(any());
    }

    @Test
    void enabledRulesClassifyEveryForwardedFailure() {
        EventDto transientRetry = error("1", "wf1");
        transientRetry.setFailureSignal(new FailureSignal("wf1", "n8n-nodes-base.httpRequest", 429,
                FailureSignal.ErrorCategory.RATE_LIMIT, true, null));
        when(n8n.getExecutionErrors(anyString(), anyString(), eq(50), any(Instant.class)))
                .thenReturn(List.of(transientRetry, error("2", "wf2"), error("3", "wf3")));
        when(n8n.fetchExecutionFailureCounts(anyString(), anyString(), any(Instant.class))).thenReturn(Map.of("wf1", 1, "wf2", 3));
        service.configureFailureTriage(new FailureTriageObserver(new RuleBasedFailureTriageClassifier(), n8n));

        service.updateInstanceStatus(instance);

        verify(alerts, times(3)).handleWorkflowError(eq(instance), anyString(), anyString());
        assertThat(logs.list).hasSize(3);
        assertThat(logs.list.get(0).getFormattedMessage()).contains("decision=NOISE");
        assertThat(logs.list.get(1).getFormattedMessage()).contains("decision=ALERT");
        assertThat(logs.list.get(2).getFormattedMessage()).contains("decision=UNSURE");
    }

    @Test
    void providerFailureDoesNotBreakLoopOrPreventLastCheckUpdate() {
        when(n8n.getExecutionErrors(anyString(), anyString(), eq(50), any(Instant.class)))
                .thenReturn(List.of(error("1", "wf1"), error("2", "wf2")));
        when(n8n.fetchExecutionFailureCounts(anyString(), anyString(), any(Instant.class))).thenReturn(Map.of());
        when(classifier.classify(any())).thenThrow(new IllegalStateException("PRIVATE failure"))
                .thenReturn(TriageDecision.unsure("provider_timeout"));
        service.configureFailureTriage(new FailureTriageObserver(classifier, n8n));

        service.updateInstanceStatus(instance);

        verify(alerts, times(2)).handleWorkflowError(eq(instance), anyString(), anyString());
        verify(classifier, times(2)).classify(any());
        assertThat(logs.list).hasSize(2).allSatisfy(log -> assertThat(log.getFormattedMessage()).contains("decision=UNSURE"));
        assertThat(instance.getLastErrorCheck()).isNotNull();
    }

    @Test
    void unavailableHistoryStillClassifiesWithUnknownCount() {
        when(n8n.getExecutionErrors(anyString(), anyString(), eq(50), any(Instant.class))).thenReturn(List.of(error("1", "wf1")));
        when(n8n.fetchExecutionFailureCounts(anyString(), anyString(), any(Instant.class)))
                .thenThrow(new IllegalStateException("PRIVATE history error"));
        when(classifier.classify(any())).thenReturn(TriageDecision.unsure("insufficient_evidence"));
        service.configureFailureTriage(new FailureTriageObserver(classifier, n8n));

        service.updateInstanceStatus(instance);

        verify(alerts).handleWorkflowError(eq(instance), anyString(), anyString());
        verify(classifier).classify(new FailureSignal("wf1", null, null, FailureSignal.ErrorCategory.UNKNOWN, false, null));
        assertThat(instance.getLastErrorCheck()).isNotNull();
    }

    private static EventDto error(String id, String workflowId) {
        EventDto error = new EventDto();
        error.setId(id);
        error.setOccurredAt(Instant.now());
        error.setPayload(Map.of("workflowId", workflowId, "workflowName", "PRIVATE workflow",
                "errorMessage", "PRIVATE error message", "payload", "PRIVATE execution payload"));
        return error;
    }
}
