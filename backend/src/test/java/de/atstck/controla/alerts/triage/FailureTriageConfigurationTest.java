package de.atstck.controla.alerts.triage;

import de.atstck.controla.service.N8nApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class FailureTriageConfigurationTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(FailureTriageConfiguration.class)
            .withBean(N8nApiClient.class, () -> mock(N8nApiClient.class));

    @Test
    void disabledByDefaultEvenWithJevKeyConfigured() {
        context.withPropertyValues("controla.triage.provider=jev", "controla.triage.jev.api-key=test-key")
                .run(application -> {
                    assertThat(application).doesNotHaveBean(FailureTriageClassifier.class);
                    assertThat(application).doesNotHaveBean(FailureTriageObserver.class);
                });
    }

    @Test
    void explicitlyDisabledFlagCreatesNoObserverForCustomClassifier() {
        FailureTriageClassifier classifier = mock(FailureTriageClassifier.class);
        context.withPropertyValues("controla.triage.enabled=false")
                .withBean(FailureTriageClassifier.class, () -> classifier).run(application -> {
                    assertThat(application).doesNotHaveBean(FailureTriageObserver.class);
                    verifyNoInteractions(classifier);
                });
    }

    @Test
    void enabledDefaultsToRules() {
        context.withPropertyValues("controla.triage.enabled=true").run(application -> {
            assertThat(application).hasSingleBean(FailureTriageObserver.class);
            assertThat(application.getBean(FailureTriageClassifier.class)).isInstanceOf(RuleBasedFailureTriageClassifier.class);
        });
    }

    @Test
    void jevRequiresKeyAndFlag() {
        context.withPropertyValues("controla.triage.enabled=true", "controla.triage.provider=jev").run(application -> {
            FailureTriageClassifier classifier = application.getBean(FailureTriageClassifier.class);
            assertThat(classifier).isNotInstanceOf(JevFailureTriageClassifier.class);
            assertThat(classifier.classify(new FailureSignal(null, null, null, null, false, null)))
                    .isEqualTo(TriageDecision.unsure("provider_not_configured"));
        });
        context.withPropertyValues("controla.triage.enabled=true", "controla.triage.provider=jev",
                "controla.triage.jev.api-key=test-key").run(application ->
                assertThat(application.getBean(FailureTriageClassifier.class)).isInstanceOf(JevFailureTriageClassifier.class));
    }

    @Test
    void customClassifierReplacesDefault() {
        FailureTriageClassifier classifier = mock(FailureTriageClassifier.class);
        context.withPropertyValues("controla.triage.enabled=true")
                .withBean(FailureTriageClassifier.class, () -> classifier).run(application -> {
                    assertThat(application).hasSingleBean(FailureTriageClassifier.class);
                    assertThat(application.getBean(FailureTriageClassifier.class)).isSameAs(classifier);
                });
    }
}
