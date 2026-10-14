package de.atstck.controla.security;

import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * Extension point: decides which addresses calls to customer-provided URLs
 * (n8n base URLs, companion URLs) may reach. The Community default allows
 * everything, because self-hosted installations usually talk to local
 * networks; the SaaS edition blocks internal addresses (SSRF protection).
 *
 * Enforcement happens on the resolved IP address in {@link PolicyDnsResolver},
 * so it also covers redirects and DNS rebinding.
 */
public interface InstanceTargetPolicy {

    boolean isAllowed(InetAddress address);

    /** Resolves {@code host} and fails with {@link TargetNotAllowedException} if any address is blocked. */
    default InetAddress[] resolveAllowed(String host) throws UnknownHostException {
        InetAddress[] addresses = InetAddress.getAllByName(host);
        for (InetAddress address : addresses) {
            if (!isAllowed(address)) {
                throw new TargetNotAllowedException(host, address);
            }
        }
        return addresses;
    }
}
