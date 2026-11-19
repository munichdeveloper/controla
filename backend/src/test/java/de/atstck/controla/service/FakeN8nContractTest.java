package de.atstck.controla.service;

import de.atstck.controla.testing.FakeN8n;
import org.junit.jupiter.api.Test;
import org.opentest4j.MultipleFailuresError;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FakeN8nContractTest {

    @Test
    void fakeSatisfiesTheRealN8nContract() throws Exception {
        try (FakeN8n fake = FakeN8n.start()) {
            N8nApiContract.verify(prepare(fake.instance("contract")));
        }
    }

    @Test
    void contractRejectsADeliberateFakeDeviation() throws Exception {
        try (FakeN8n fake = FakeN8n.start()) {
            FakeN8n.Instance instance = fake.instance("mutated");
            N8nApiContract.Target target = prepare(instance);
            instance.version("0.0.0-contract-drift");

            assertThatThrownBy(() -> N8nApiContract.verify(target))
                    .isInstanceOf(MultipleFailuresError.class).hasMessageContaining("installed version");
        }
    }

    private static N8nApiContract.Target prepare(FakeN8n.Instance instance) {
        // Arbitrary fixture version: the contract must check the exact value, not just a major version.
        String version = "99.1.2";
        instance.version(version);
        RestTemplate rest = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-N8N-API-KEY", instance.apiKey());
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<?, ?> workflow = rest.exchange(instance.baseUrl() + "/api/v1/workflows", HttpMethod.POST,
                new HttpEntity<>(N8nApiContract.failingWorkflow(), headers), Map.class).getBody();
        assertThat(workflow).isNotNull();
        String workflowId = (String) workflow.get("id");
        Instant startedAt = Instant.parse("2026-11-17T12:00:00Z");
        String executionId = instance.addErrorExecution(workflowId, N8nApiContract.ERROR_MESSAGE, startedAt);
        return new N8nApiContract.Target(instance.baseUrl(), instance.apiKey(), version, workflowId, executionId, startedAt);
    }
}
