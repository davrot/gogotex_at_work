package uk.ac.ic.wlgitbridge.auth;

import org.junit.Assert;
import org.junit.Test;

import java.util.Optional;

public class SSHAuthManagerFingerprintLookupTest {
    @Test
    public void fingerprintFastPath_authorizesKnownUser() {
        // create a fake client that returns user id for fingerprint
        WebProfileClient fakeClient = new WebProfileClient("http://localhost", null) {
            @Override
            public Optional<String> getUserIdForFingerprint(String fingerprint) {
                return Optional.of("user123");
            }
        };

        SSHAuthManager authManager = new SSHAuthManager(fakeClient);
        // use a known public key; here we use a minimal sha256 fingerprint string
        String presentedPublicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQfake"; // base64 payload omitted; fingerprint handler doesn't decode here
        boolean authorized = authManager.isKeyAuthorized("user123", presentedPublicKey);
        Assert.assertTrue(authorized);
    }
}
