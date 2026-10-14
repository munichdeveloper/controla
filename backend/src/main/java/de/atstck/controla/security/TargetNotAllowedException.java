package de.atstck.controla.security;

import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * Raised when a customer-provided URL resolves to an address the
 * {@link InstanceTargetPolicy} blocks. Extends {@link UnknownHostException}
 * so HTTP clients treat it like an unreachable host.
 */
public class TargetNotAllowedException extends UnknownHostException {

    private final String host;
    private final String address;

    public TargetNotAllowedException(String host, InetAddress address) {
        super("Target address not allowed: " + host + " (" + address.getHostAddress() + ")");
        this.host = host;
        this.address = address.getHostAddress();
    }

    public String getHost() {
        return host;
    }

    public String getAddress() {
        return address;
    }
}
