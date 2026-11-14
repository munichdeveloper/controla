package de.atstck.controla.instance;

public record InstanceDeleteOptions(boolean deleteExternalData) {
    public static final InstanceDeleteOptions DEFAULT = new InstanceDeleteOptions(false);
}
