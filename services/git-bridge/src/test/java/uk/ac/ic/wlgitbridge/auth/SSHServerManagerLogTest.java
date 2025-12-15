package uk.ac.ic.wlgitbridge.auth;

import org.junit.Test;
import java.net.ServerSocket;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.session.ClientSession;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.slf4j.LoggerFactory;

import static org.junit.Assert.assertTrue;

public class SSHServerManagerLogTest {

  static class MockAuthManager extends SSHAuthManager {
    public MockAuthManager() { super(null); }
    @Override
    public boolean isKeyAuthorized(String userId, String presentedPublicKey) { return true; }
  }

  @Test
  public void testAuthSshAttemptLogEmitted() throws Exception {
    int port;
    try (ServerSocket s = new ServerSocket(0)) {
      port = s.getLocalPort();
    }

    MockAuthManager mam = new MockAuthManager();
    SSHServerManager manager = new SSHServerManager(port, mam, null, null);

    // Attach test appender to capture logs
    Logger root = (Logger) LoggerFactory.getLogger("uk.ac.ic.wlgitbridge.application.GitBridgeApp");
    ListAppender<ILoggingEvent> listAppender = new ListAppender<>();
    listAppender.start();
    root.addAppender(listAppender);

    manager.start();

    SshClient client = SshClient.setUpDefaultClient();
    client.start();
    KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
    kpg.initialize(2048);
    KeyPair kp = kpg.generateKeyPair();

    try (ClientSession session = client.connect("testuser", "localhost", port).verify(5000).getSession()) {
      session.addPublicKeyIdentity(kp);
      session.auth().verify(5000);
    }

    client.stop();
    manager.stop();

    boolean found = listAppender.list.stream().anyMatch(ev -> ev.getFormattedMessage().contains("auth.ssh_attempt"));
    assertTrue("Expected auth.ssh_attempt log entry", found);
  }
}
