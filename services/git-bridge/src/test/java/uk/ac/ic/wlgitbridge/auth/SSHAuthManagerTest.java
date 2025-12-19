package uk.ac.ic.wlgitbridge.auth;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class SSHAuthManagerTest {

    static class StubProfileClient extends WebProfileClient {
        private final List<SSHKey> keys;
        public StubProfileClient(List<SSHKey> keys) {
            super("http://unused","token");
            this.keys = keys;
        }
        @Override
        public List<SSHKey> getUserSSHKeys(String userId) {
            return keys;
        }
    }

    @Test
    public void testAuthorizedWhenExactKeyMatches() {
        SSHKey key = new SSHKey("1","u1","laptop","ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDummyKey== test@host");
        WebProfileClient client = new StubProfileClient(Arrays.asList(key));
        SSHAuthManager m = new SSHAuthManager(client);
        assertTrue(m.isKeyAuthorized("u1", "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDummyKey== another@host"));
    }

    @Test
    public void testUnauthorizedWhenDifferentKey() {
        SSHKey key = new SSHKey("1","u1","laptop","ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDummyKey== test@host");
        WebProfileClient client = new StubProfileClient(Arrays.asList(key));
        SSHAuthManager m = new SSHAuthManager(client);
        assertFalse(m.isKeyAuthorized("u1", "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOtherKey== another@host"));
    }

    @Test
    public void testFingerprintFastPathLookup() throws Exception {
        WebProfileClient client = mock(WebProfileClient.class);
        when(client.getUserIdForFingerprint(startsWith("SHA256:"))).thenReturn(java.util.Optional.of("u2"));
        SSHAuthManager m = new SSHAuthManager(client);
        // should authorize because fingerprint lookup returns user
        assertTrue(m.isKeyAuthorized("u2", "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7 comment"));
        verify(client, atLeastOnce()).getUserIdForFingerprint(startsWith("SHA256:"));
    }

    @Test
    public void testIntrospectionFallback() throws Exception {
        WebProfileClient client = mock(WebProfileClient.class);
        WebProfileClient.TokenIntrospection ti = new WebProfileClient.TokenIntrospection(true, java.util.Optional.of("u3"), java.util.Collections.emptyList(), null);
        when(client.introspectToken("tok123")).thenReturn(ti);
        SSHAuthManager m = new SSHAuthManager(client);
        // supplied token should authorize even if key lookup fails
        assertTrue(m.isKeyAuthorized("u3", "ssh-rsa INVALID", client, "tok123"));
        verify(client, atLeastOnce()).introspectToken("tok123");
    }

    @Test
    public void testFingerprintNonEmptyAndFormat() {
        String pub = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7 example@host";
        String fp = SSHAuthManager.fingerprintOpenSSH(pub);
        assertNotNull(fp);
        assertFalse(fp.isEmpty());
        // fingerprintOpenSSH returns raw base64 digest (without the "SHA256:" prefix)
        assertFalse(fp.contains(":"));
    }
}
