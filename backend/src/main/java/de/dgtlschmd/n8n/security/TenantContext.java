package de.dgtlschmd.n8n.security;

public class TenantContext {
    private static final ThreadLocal<String> currentTenant = new ThreadLocal<>();

    public static void setTenantId(String tenantId) {
        currentTenant.set(tenantId);
    }

    public static String getTenantId() {
        String tenantId = currentTenant.get();
        return tenantId != null ? tenantId : "default";
    }

    public static void clear() {
        currentTenant.remove();
    }
}