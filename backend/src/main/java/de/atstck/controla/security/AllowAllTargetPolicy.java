package de.atstck.controla.security;

import java.net.InetAddress;

/** Community default: every target address is allowed. */
public class AllowAllTargetPolicy implements InstanceTargetPolicy {
    @Override
    public boolean isAllowed(InetAddress address) {
        return true;
    }
}
