package uk.ac.ic.wlgitbridge.auth;

import org.junit.Test;
import java.net.ServerSocket;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ClientChannel;
import org.apache.sshd.client.future.AuthFuture;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.common.keyprovider.KeyPairProvider;
import java.util.concurrent.TimeUnit;

public class SSHServerManagerTest {

  static class MockAuthManager extends SSHAuthManager {
    public MockAuthManager() { super(null); }
    @Override
    public boolean isKeyAuthorized(String userId, String presentedPublicKey) { return true; }
  }

  @Test
  public void testSshServerStartsAndAcceptsPublicKey() throws Exception {
    int port;
    try (ServerSocket s = new ServerSocket(0)) {
      port = s.getLocalPort();
    }

    MockAuthManager mam = new MockAuthManager();
    SSHServerManager manager = new SSHServerManager(port, mam, null, null, null);
    manager.start();

    SshClient client = SshClient.setUpDefaultClient();
    client.start();
    KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
    kpg.initialize(2048);
    KeyPair kp = kpg.generateKeyPair();

    try (ClientSession session = client.connect("testuser", "localhost", port).verify(5000).getSession()) {
      session.addPublicKeyIdentity(kp);
      session.auth().verify(5000);
      // If we reach here authentication succeeded
    }

    client.stop();
    manager.stop();
  }
}
