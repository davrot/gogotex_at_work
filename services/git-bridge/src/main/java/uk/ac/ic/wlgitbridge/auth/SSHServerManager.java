package uk.ac.ic.wlgitbridge.auth;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.PublicKey;
import java.util.Base64;
import java.util.concurrent.Executors;
import org.apache.sshd.common.config.keys.KeyUtils;
import org.apache.sshd.server.keyprovider.SimpleGeneratorHostKeyProvider;
import org.apache.sshd.server.SshServer;
import org.apache.sshd.server.auth.pubkey.PublickeyAuthenticator;
import org.apache.sshd.server.command.Command;
import org.apache.sshd.server.command.CommandFactory;
import org.apache.sshd.server.session.ServerSession;
import org.apache.sshd.server.channel.ChannelSession;
import org.apache.sshd.server.channel.ChannelSessionAware;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.util.Log;

/**
 * Minimal embedded SSH server that supports publickey auth and executing git-upload-pack / git-receive-pack.
 */
public class SSHServerManager {
  private final int port;
  private final SSHAuthManager authManager;
  private final String rootGitDir;
  private final RepoStore repoStore;
  private final Bridge bridge;
  private SshServer server;

  private static final java.util.concurrent.ConcurrentHashMap<ServerSession, String> sessionUserMap = new java.util.concurrent.ConcurrentHashMap<>();

  public SSHServerManager(int port, SSHAuthManager authManager, RepoStore repoStore, Bridge bridge, String rootGitDir) {
    this.port = port;
    this.authManager = authManager;
    this.repoStore = repoStore;
    this.bridge = bridge;
    this.rootGitDir = rootGitDir;
  }

  public void start() throws IOException {
    server = SshServer.setUpDefaultServer();
    server.setHost("0.0.0.0");
    server.setPort(port);
    // Host key provider: use a persistent file inside the root Git directory so
    // host key survives restarts and avoids changing fingerprints unexpectedly.
    File hostKey = new File(rootGitDir, "ssh_hostkey.ser");
    try {
      if (!hostKey.getParentFile().exists()) hostKey.getParentFile().mkdirs();
    } catch (Exception ignored) {}
    server.setKeyPairProvider(new SimpleGeneratorHostKeyProvider(hostKey.toPath()));
    Log.info("Using persistent SSH host key: " + hostKey.getAbsolutePath());

    server.setPublickeyAuthenticator(new PublickeyAuthenticator() {
      @Override
      public boolean authenticate(String username, PublicKey key, ServerSession session) {
        try {
          String keyType = KeyUtils.getKeyType(key);
          String openssh;
          try {
            // Try to construct an OpenSSH-style public key blob so that fingerprint
            // computation matches keys stored in the WebProfile (which are OpenSSH-format strings).
            if ("ssh-rsa".equals(keyType) && key instanceof java.security.interfaces.RSAPublicKey) {
              java.security.interfaces.RSAPublicKey rsa = (java.security.interfaces.RSAPublicKey) key;
              byte[] blob = buildRsaSshKeyBlob(rsa);
              String b64 = Base64.getEncoder().encodeToString(blob);
              openssh = keyType + " " + b64;
            } else {
              // Fallback: encode X.509 encoded key bytes to base64 (may differ from OpenSSH wire format for some key types)
              String b64 = Base64.getEncoder().encodeToString(key.getEncoded());
              openssh = keyType + " " + b64;
            }
          } catch (Exception ex) {
            String b64 = Base64.getEncoder().encodeToString(key.getEncoded());
            openssh = keyType + " " + b64;
          }
          Log.debug("SSH auth attempt for user {} with key {}", username, openssh.substring(0, Math.min(openssh.length(), 80)));
          String fp = SSHAuthManager.fingerprintOpenSSH(openssh);
          String fpCanonical = fp.isEmpty() ? "" : "SHA256:" + fp;

          // Try to learn userId from fingerprint fast-path
          java.util.Optional<String> optUser = authManager.getUserIdForKey(openssh);
          String resolvedUser = null;
          boolean ok = false;
          if (optUser.isPresent()) {
            resolvedUser = optUser.get();
            ok = true;
          } else {
            // Fallback: accept username if isKeyAuthorized matches
            ok = authManager.isKeyAuthorized(username, openssh);
            if (ok) resolvedUser = username;
          }

          // Emit structured log for auth.ssh_attempt
          java.util.Map<String,Object> evt = new java.util.HashMap<>();
          evt.put("event", "auth.ssh_attempt");
          evt.put("service", "git-bridge");
          evt.put("level", ok ? "info" : "warn");
          evt.put("userId", resolvedUser == null ? username : resolvedUser);
          evt.put("fingerprint", fpCanonical);
          evt.put("outcome", ok ? "success" : "failure");
          Log.info(new com.google.gson.Gson().toJson(evt));

          if (ok && resolvedUser != null) {
            // store authenticated userId in map for later RPC checks
            sessionUserMap.put(session, resolvedUser);
          }
          return ok;
        } catch (Exception e) {
          Log.warn("Error during publickey auth: {}", e.getMessage());
          return false;
        }
      }
    });

    server.setCommandFactory(new CommandFactory() {
      @Override
      public Command createCommand(ChannelSession channel, String command) {
        return new ProcessCommand(channel, command, rootGitDir);
      }
    });
    server.start();
  }

  public void stop() {
    if (server != null) {
      try {
        server.stop();
      } catch (Exception e) {
        Log.warn("Failed to stop SSH server: {}", e.getMessage());
      }
    }
  }

  /**
   * Returns the actual listening port of the embedded SSH server. If the
   * server has not been started, returns the configured port (may be 0).
   */
  public int getListeningPort() {
    if (server == null) return port;
    try {
      return server.getPort();
    } catch (Exception e) {
      return port;
    }
  }

  // Helper: build OpenSSH-format blob for RSA keys (string "ssh-rsa" + mpint e + mpint n)
  private static byte[] buildRsaSshKeyBlob(java.security.interfaces.RSAPublicKey rsa) throws java.io.IOException {
    try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
      writeString(baos, "ssh-rsa".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      writeMpint(baos, rsa.getPublicExponent());
      writeMpint(baos, rsa.getModulus());
      return baos.toByteArray();
    }
  }

  private static void writeString(java.io.ByteArrayOutputStream baos, byte[] data) throws java.io.IOException {
    int len = data.length;
    baos.write(new byte[] { (byte)((len >> 24) & 0xff), (byte)((len >> 16) & 0xff), (byte)((len >> 8) & 0xff), (byte)(len & 0xff) });
    baos.write(data);
  }

  private static void writeMpint(java.io.ByteArrayOutputStream baos, java.math.BigInteger v) throws java.io.IOException {
    if (v == null) v = java.math.BigInteger.ZERO;
    byte[] raw = v.toByteArray();
    // Keep BigInteger.toByteArray() as-is to preserve sign byte (per RFC4251 mpint rules)
    writeString(baos, raw);
  }

  // Simple command wrapper that runs the requested program in a shell
  class ProcessCommand implements Command, ChannelSessionAware, Runnable {
    private final ChannelSession channel;
    private final String command;
    private final String root;
    private Process process;
    private java.io.InputStream in;
    private java.io.OutputStream out;
    private java.io.OutputStream err;
    private org.apache.sshd.server.ExitCallback callback;

    public ProcessCommand(ChannelSession channel, String command, String root) {
      this.channel = channel;
      this.command = command;
      this.root = root;
    }

    @Override
    public void setChannelSession(ChannelSession channel) {}

    @Override
    public void start(ChannelSession channel, org.apache.sshd.server.Environment env) throws IOException {
      // Before executing, enforce membership checks for git RPCs
      String cmd = command == null ? "" : command.trim();
      String lower = cmd.toLowerCase();
      if (lower.startsWith("git-upload-pack") || lower.startsWith("git-receive-pack")) {
        // Extract repo path argument
        String[] parts = cmd.split(" ", 2);
        String repoArg = parts.length > 1 ? parts[1].trim() : "";
        // Strip surrounding quotes
        if ((repoArg.startsWith("'") && repoArg.endsWith("'")) || (repoArg.startsWith("\"") && repoArg.endsWith("\""))) {
          repoArg = repoArg.substring(1, repoArg.length()-1);
        }
        // Derive projectId as basename without .git
        String project = repoArg;
        int lastSlash = project.lastIndexOf('/');
        if (lastSlash >= 0) project = project.substring(lastSlash + 1);
        if (project.endsWith(".git")) project = project.substring(0, project.length() - 4);

        // Determine userId from session
        String userId = null;
        try {
          ServerSession ss = channel.getSession();
          String mapped = sessionUserMap.get(ss);
          if (mapped != null) userId = mapped;
        } catch (Exception ignored) {}

        boolean allowed = true;
        String membershipBase = System.getenv("MEMBERSHIP_API_BASE_URL");
          if (membershipBase == null || membershipBase.isEmpty()) {
            membershipBase = System.getProperty("MEMBERSHIP_API_BASE_URL");
          }
        if (membershipBase != null && !membershipBase.isEmpty() && userId != null) {
          String url = String.format("%s/internal/api/projects/%s/members/%s", membershipBase, java.net.URLEncoder.encode(project, java.nio.charset.StandardCharsets.UTF_8), java.net.URLEncoder.encode(userId, java.nio.charset.StandardCharsets.UTF_8));
          try (org.apache.http.impl.client.CloseableHttpClient http = org.apache.http.impl.client.HttpClients.createDefault()) {
            org.apache.http.client.methods.HttpGet get = new org.apache.http.client.methods.HttpGet(url);
            String membershipApiToken = System.getenv("MEMBERSHIP_API_TOKEN");
            if (membershipApiToken != null && !membershipApiToken.isEmpty()) {
              get.addHeader("Authorization", "Bearer " + membershipApiToken);
            }
            try (org.apache.http.client.methods.CloseableHttpResponse resp = http.execute(get)) {
              int status = resp.getStatusLine().getStatusCode();
              if (status >= 200 && status < 300) {
                allowed = true;
              } else {
                allowed = false;
              }
            }
          } catch (Exception e) {
            // On membership lookup failure, be conservative and deny
            allowed = false;
          }
        }

        // Ensure repo exists and is synced before allowing Git RPCs (if bridge provided)
        if (allowed && bridge != null) {
          try {
            bridge.getUpdatedRepo(java.util.Optional.empty(), project);
          } catch (Exception e) {
            Log.warn("Failed to ensure repo for project {}: {}", project, e.getMessage());
            allowed = false;
          }
        }

        // Emit structured log for RPC auth outcome
        java.util.Map<String,Object> evt = new java.util.HashMap<>();
        evt.put("event", "auth.ssh_attempt");
        evt.put("service", "git-bridge");
        evt.put("userId", userId);
        evt.put("repo", project);
        evt.put("outcome", allowed ? "allowed" : "denied");
        Log.info(new com.google.gson.Gson().toJson(evt));

        if (!allowed) {
          // Deny with error message on stderr and exit non-zero
          if (err != null) {
            try {
              err.write(("ERROR: not a project member\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
              err.flush();
            } catch (IOException ignored) {}
          }
          if (callback != null) callback.onExit(1, "not a project member");
          return;
        }
      }

      // For git RPCs, the client passes a path like '/<project>.git'. Our repo layout uses
      // a project directory containing a .git subdirectory, so rewrite the command to point
      // at the project directory rather than the trailing '.git' path to ensure git-upload-pack
      // and git-receive-pack operate on the expected repository on disk.
      String execCommand = command;
      if (cmd != null && (lower.startsWith("git-upload-pack") || lower.startsWith("git-receive-pack"))) {
        String[] cmdParts = cmd.split(" ", 2);
        String cmdName = cmdParts.length > 0 ? cmdParts[0] : cmd;
        String repoArg = cmdParts.length > 1 ? cmdParts[1].trim() : "";
        if ((repoArg.startsWith("'") && repoArg.endsWith("'")) || (repoArg.startsWith("\"") && repoArg.endsWith("\""))) {
          repoArg = repoArg.substring(1, repoArg.length()-1);
        }
        if (repoArg.startsWith("/")) repoArg = repoArg.substring(1);
        if (repoArg.endsWith(".git")) repoArg = repoArg.substring(0, repoArg.length()-4);
        String repoPath = (root != null && !root.isEmpty()) ? (root + "/" + repoArg + "/.git") : (repoArg + "/.git");
        // Wrap with tee to capture server-side stdout/stderr for debugging hangs
        String outFile = "/tmp/git-upload-pack-" + repoArg + ".out";
        String errFile = "/tmp/git-upload-pack-" + repoArg + ".err";
        execCommand = cmdName + " '" + repoPath + "' 2>" + errFile + " | tee " + outFile;
      }

      Log.debug("ProcessCommand: executing shell command: {}", execCommand);
      ProcessBuilder pb = new ProcessBuilder("/bin/sh", "-lc", execCommand);
      if (root != null && !root.isEmpty()) {
        pb.directory(new File(root));
      }
      Log.debug("ProcessCommand: working directory: {}", pb.directory());
      pb.redirectErrorStream(false);
      process = pb.start();
      Log.debug("ProcessCommand: started process pid={} cmd={}", process.pid(), execCommand);
      Thread ioThread = new Thread(this);
      ioThread.setDaemon(true);
      ioThread.start();
    }

    @Override
    public void destroy(ChannelSession channel) throws Exception {
      if (process != null) process.destroyForcibly();
    }

    @Override
    public void setInputStream(java.io.InputStream in) {
      this.in = in;
    }

    @Override
    public void setOutputStream(java.io.OutputStream out) {
      this.out = out;
    }

    @Override
    public void setErrorStream(java.io.OutputStream err) {
      this.err = err;
    }

    @Override
    public void setExitCallback(org.apache.sshd.server.ExitCallback callback) {
      this.callback = callback;
    }

    @Override
    public void run() {
      Log.debug("ProcessCommand: run() starting for pid={}", process == null ? -1 : process.pid());
      try (java.io.InputStream procOut = process.getInputStream();
          java.io.InputStream procErr = process.getErrorStream();
          java.io.OutputStream procIn = process.getOutputStream()) {
        // Pump input -> process stdin
        Thread tIn = new Thread(() -> {
          try {
            Log.debug("ProcessCommand: stdin pump started");
            if (in != null) {
              byte[] buf = new byte[8192];
              int n;
              while ((n = in.read(buf)) != -1) {
                procIn.write(buf, 0, n);
                procIn.flush();
                Log.debug("ProcessCommand: stdin pump forwarded {} bytes", n);
              }
            }
            procIn.close();
            Log.debug("ProcessCommand: stdin pump finished");
          } catch (IOException e) {
            Log.warn("ProcessCommand: stdin pump error: {}", e.getMessage());
          }
        });
        tIn.setDaemon(true);
        tIn.start();

        // Pump process stdout -> ssh out (use small reads + flush to avoid NIO2 non-blocking issues)
        Thread tOut = new Thread(() -> {
          try {
            Log.debug("ProcessCommand: stdout pump started");
            if (out != null) {
              byte[] buf = new byte[8192];
              int n;
              while ((n = procOut.read(buf)) != -1) {
                out.write(buf, 0, n);
                out.flush();
              }
            }
            Log.debug("ProcessCommand: stdout pump finished");
          } catch (IOException e) {
            Log.warn("ProcessCommand: stdout pump error: {}", e.getMessage());
          }
        });
        tOut.setDaemon(true);
        tOut.start();

        // Pump process stderr -> ssh err (small reads + flush)
        Thread tErr = new Thread(() -> {
          try {
            Log.debug("ProcessCommand: stderr pump started");
            if (err != null) {
              byte[] buf = new byte[8192];
              int n;
              while ((n = procErr.read(buf)) != -1) {
                err.write(buf, 0, n);
                err.flush();
              }
            }
            Log.debug("ProcessCommand: stderr pump finished");
          } catch (IOException e) {
            Log.warn("ProcessCommand: stderr pump error: {}", e.getMessage());
          }
        });
        tErr.setDaemon(true);
        tErr.start();

        int code = process.waitFor();
        Log.debug("ProcessCommand: process exited with code={}", code);
        if (callback != null) callback.onExit(code);
      } catch (Exception e) {
        Log.warn("ProcessCommand: exception while running command: {}", e.getMessage());
        if (callback != null) callback.onExit(1, e.getMessage());
      }
    }
  }
}
