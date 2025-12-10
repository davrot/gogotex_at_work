package uk.ac.ic.wlgitbridge.auth;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.*;

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
}
