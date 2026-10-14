package de.atstck.controla.security;

import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.SystemDefaultDnsResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * DNS resolver for HttpClient 5 that applies the {@link InstanceTargetPolicy}
 * to every resolved address. HttpClient resolves each connection target
 * through this resolver (initial request and every redirect hop), and connects
 * to exactly the addresses returned here.
 */
public class PolicyDnsResolver implements DnsResolver {

    private static final Logger logger = LoggerFactory.getLogger(PolicyDnsResolver.class);

    private final InstanceTargetPolicy policy;

    public PolicyDnsResolver(InstanceTargetPolicy policy) {
        this.policy = policy;
    }

    @Override
    public InetAddress[] resolve(String host) throws UnknownHostException {
        InetAddress[] addresses = SystemDefaultDnsResolver.INSTANCE.resolve(host);
        for (InetAddress address : addresses) {
            if (!policy.isAllowed(address)) {
                logger.warn("Blocked outbound request by target policy: host={}, address={}, tenantId={}",
                        host, address.getHostAddress(), TenantContext.getTenantId());
                throw new TargetNotAllowedException(host, address);
            }
        }
        return addresses;
    }

    @Override
    public String resolveCanonicalHostname(String host) throws UnknownHostException {
        return SystemDefaultDnsResolver.INSTANCE.resolveCanonicalHostname(host);
    }
}
