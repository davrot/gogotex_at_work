package uk.ac.ic.wlgitbridge.auth;

import org.junit.Test;
import java.net.ServerSocket;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ClientChannel;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.future.AuthFuture;
import org.apache.sshd.client.session.ClientSession;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.slf4j.LoggerFactory;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import static org.junit.Assert.assertTrue;

public class SSHServerManagerMembershipTest {

  static class MockAuthManager extends SSHAuthManager {
    public MockAuthManager() { super(null); }
    @Override
    public boolean isKeyAuthorized(String userId, String presentedPublicKey) { return true; }
    @Override
    public java.util.Optional<String> getUserIdForKey(String presentedPublicKey) { return java.util.Optional.of("user123"); }
  }

  @Test
  public void testMembershipDeniedForNonMember() throws Exception {
    int port;
    try (ServerSocket s = new ServerSocket(0)) {
      port = s.getLocalPort();
    }

    // Start a tiny HTTP server that always returns 404 for membership check
    HttpServer http = HttpServer.create(new InetSocketAddress(0), 0);
    int httpPort = http.getAddress().getPort();
    http.createContext("/internal/api/projects/repo/members/user123", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws java.io.IOException {
        exchange.sendResponseHeaders(404, -1);
        exchange.close();
      }
    });
    http.start();

    System.setProperty("MEMBERSHIP_API_BASE_URL", "http://localhost:" + http.getAddress().getPort());
    // ensure SERVER uses env var not property; also set environment via process builder is not possible here in test

    MockAuthManager mam = new MockAuthManager();
    SSHServerManager manager = new SSHServerManager(port, mam, null, null, null);

    // Capture logs
    Logger root = (Logger) LoggerFactory.getLogger("uk.ac.ic.wlgitbridge.application.GitBridgeApp");
    ch.qos.logback.classic.LoggerContext lc = root.getLoggerContext();
    ListAppender<ILoggingEvent> listAppender = new ListAppender<>();
    listAppender.start();
    root.addAppender(listAppender);

    manager.start();

    SshClient client = SshClient.setUpDefaultClient();
    client.start();
    KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
    kpg.initialize(2048);
    KeyPair kp = kpg.generateKeyPair();

    try (ClientSession session = client.connect("user123", "localhost", port).verify(5000).getSession()) {
      session.addPublicKeyIdentity(kp);
      session.auth().verify(5000);
      try (ClientChannel ch = session.createExecChannel("git-receive-pack 'repo.git'")) {
        ch.open().verify(5000);
        ch.waitFor(java.util.EnumSet.of(ClientChannelEvent.CLOSED), 5000);
        // exit status should be nonzero due to membership denial
      }
    }

    client.stop();
    manager.stop();
    http.stop(0);

    boolean found = listAppender.list.stream().anyMatch(ev -> ev.getFormattedMessage().contains("\"repo\":\"repo\"") && ev.getFormattedMessage().contains("\"outcome\":\"denied\""));
    assertTrue("Expected auth.ssh_attempt repo denied log entry", found);
  }
}
