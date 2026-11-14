package de.atstck.controla.instance;

/**
 * Contributions run in the lifecycle transaction. Throwing rolls back the operation.
 * External side effects must be coordinated by the contributing edition (e.g. an outbox).
 */
public interface InstanceLifecycleListener {
    default void onArchived(Instance instance) { }
    default void onRestored(Instance instance) { }
    default void beforeDelete(Instance instance, InstanceDeleteOptions options) { }
}
