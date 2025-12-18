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
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public class SSHServerManagerUploadPackTest {

  static class MockAuthManager extends SSHAuthManager {
    public MockAuthManager() { super(null); }
    @Override
    public boolean isKeyAuthorized(String userId, String presentedPublicKey) { return true; }
    @Override
    public java.util.Optional<String> getUserIdForKey(String presentedPublicKey) { return java.util.Optional.of("user123"); }
  }

  @Test
  public void testGitUploadPackAdvertisesRefs() throws Exception {
    int port;
    try (ServerSocket s = new ServerSocket(0)) {
      port = s.getLocalPort();
    }

    // Create a bare repo in the layout expected by the server: project directory with a '.git' subdir
    Path tmp = Files.createTempDirectory("git-bridge-test-repo");
    Path projectDir = tmp.resolve("repo");
    Files.createDirectories(projectDir);
    Path repoDir = projectDir.resolve(".git");
    // Initialize bare repo at repo/.git
    ProcessBuilder pb = new ProcessBuilder("git", "init", "--bare", repoDir.toAbsolutePath().toString());
    pb.inheritIO();
    Process p = pb.start();
    int code = p.waitFor();
    if (code != 0) throw new RuntimeException("git init failed");

    // Create a temporary non-bare clone to make an initial commit and push it
    Path clone = tmp.resolve("clone");
    Files.createDirectory(clone);
    ProcessBuilder pb2 = new ProcessBuilder("git", "clone", repoDir.toAbsolutePath().toString(), clone.toAbsolutePath().toString());
    pb2.inheritIO();
    Process p2 = pb2.start();
    int c2 = p2.waitFor();
    if (c2 != 0) throw new RuntimeException("git clone failed");

    // Create a file and push
    Files.writeString(clone.resolve("file.txt"), "hello\n");
    ProcessBuilder pb3 = new ProcessBuilder("git", "-C", clone.toAbsolutePath().toString(), "add", "file.txt");
    pb3.inheritIO();
    Process p3 = pb3.start();
    p3.waitFor();
    ProcessBuilder pb4 = new ProcessBuilder("git", "-C", clone.toAbsolutePath().toString(), "commit", "-m", "initial");
    pb4.inheritIO();
    Process p4 = pb4.start();
    p4.waitFor();
    ProcessBuilder pb5 = new ProcessBuilder("git", "-C", clone.toAbsolutePath().toString(), "push", "origin", "master");
    pb5.inheritIO();
    Process p5 = pb5.start();
    p5.waitFor();

    // Start SSH server pointing root git dir at tmp
    // Ensure any external membership API config is disabled for this unit test to avoid
    // cross-test interference in CI (tests run in same JVM process sometimes).
    System.setProperty("MEMBERSHIP_API_BASE_URL", "");
    System.setProperty("MEMBERSHIP_API_TOKEN", "");

    MockAuthManager mam = new MockAuthManager();
    SSHServerManager manager = new SSHServerManager(port, mam, null, null, tmp.toAbsolutePath().toString());
    manager.start();

    SshClient client = SshClient.setUpDefaultClient();
    client.start();
    KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
    kpg.initialize(2048);
    KeyPair kp = kpg.generateKeyPair();

    try (ClientSession session = client.connect("user123", "localhost", port).verify(5000).getSession()) {
      session.addPublicKeyIdentity(kp);
      session.auth().verify(5000);
      try (ClientChannel ch = session.createExecChannel("git-upload-pack 'repo.git'")) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ch.setOut(baos);
        ch.open().verify(5000);
        // wait for channel to close or timeout
        ch.waitFor(java.util.EnumSet.of(ClientChannelEvent.CLOSED), 5000);
        String output = baos.toString("UTF-8");
        // Expect output to include refs/heads/master, refs/heads/main, or HEAD
        assertTrue("Expected git-upload-pack advertisement to contain refs/heads/master, refs/heads/main, or HEAD; got:\n" + output,
            output.contains("refs/heads/master") || output.contains("refs/heads/main") || output.contains("HEAD"));
      }
    }

    client.stop();
    manager.stop();
  }
}
