package uk.ac.ic.wlgitbridge.auth;

import org.junit.Assert;
import org.junit.Test;

import java.util.Collections;
import java.util.Optional;

public class SSHAuthManagerIntrospectFallbackTest {
    @Test
    public void introspectionFallback_authorizes_when_token_maps_to_user() {
        WebProfileClient fakeClient = new WebProfileClient("http://localhost", null) {
            @Override
            public Optional<String> getUserIdForFingerprint(String fingerprint) {
                return Optional.empty();
            }

            @Override
            public java.util.List<SSHKey> getUserSSHKeys(String userId) {
                return Collections.emptyList();
            }

            @Override
            public Optional<String> introspectToken(String token) {
                return Optional.of("user123");
            }
        };

        SSHAuthManager auth = new SSHAuthManager(fakeClient);
        boolean authorized = auth.isKeyAuthorized("user123", "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQfake", fakeClient, "token-abc");
        Assert.assertTrue(authorized);
    }

    @Test
    public void introspectionFallback_doesNotAuthorize_for_other_user() {
        WebProfileClient fakeClient = new WebProfileClient("http://localhost", null) {
            @Override
            public Optional<String> getUserIdForFingerprint(String fingerprint) {
                return Optional.empty();
            }

            @Override
            public java.util.List<SSHKey> getUserSSHKeys(String userId) {
                return Collections.emptyList();
            }

            @Override
            public Optional<String> introspectToken(String token) {
                return Optional.of("other-user");
            }
        };

        SSHAuthManager auth = new SSHAuthManager(fakeClient);
        boolean authorized = auth.isKeyAuthorized("user123", "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQfake", fakeClient, "token-abc");
        Assert.assertFalse(authorized);
    }
}
