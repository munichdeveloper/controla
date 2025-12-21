package de.dgtlschmd.n8n.alerts;

import de.dgtlschmd.n8n.instance.Instance;

public interface InstanceAlertHandler {
    void handleInvalidApiKey(Instance instance);
    void handleInstanceOffline(Instance instance);
    void handleInstanceOnline(Instance instance);
    void handleWorkflowError(Instance instance, String workflowName, String errorMessage);
}
