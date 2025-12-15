package uk.ac.ic.wlgitbridge.auth;

import org.junit.Assert;
import org.junit.Test;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

public class SSHAuthManagerInjectedClientUsageTest {
    @Test
    public void singleArg_isKeyAuthorized_usesInjectedProfileClient() {
        AtomicBoolean called = new AtomicBoolean(false);
        WebProfileClient fakeClient = new WebProfileClient("http://localhost", null) {
            @Override
            public Optional<String> getUserIdForFingerprint(String fingerprint) {
                called.set(true);
                return Optional.of("user123");
            }
        };

        SSHAuthManager auth = new SSHAuthManager(fakeClient);
        boolean authorized = auth.isKeyAuthorized("user123", "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQfake");
        Assert.assertTrue("Injected profile client should be used for fingerprint lookup", called.get());
        Assert.assertTrue(authorized);
    }
}
