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
  private SshServer server;

  private static final java.util.concurrent.ConcurrentHashMap<ServerSession, String> sessionUserMap = new java.util.concurrent.ConcurrentHashMap<>();

  public SSHServerManager(int port, SSHAuthManager authManager, RepoStore repoStore, String rootGitDir) {
    this.port = port;
    this.authManager = authManager;
    this.repoStore = repoStore;
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
          // Fallback: encode X.509 encoded key bytes to base64 (may differ from OpenSSH wire format for some key types)
          String b64 = Base64.getEncoder().encodeToString(key.getEncoded());
          String openssh = keyType + " " + b64;
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

  // Simple command wrapper that runs the requested program in a shell
  static class ProcessCommand implements Command, ChannelSessionAware, Runnable {
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

      ProcessBuilder pb = new ProcessBuilder("/bin/sh", "-lc", command);
      if (root != null && !root.isEmpty()) {
        pb.directory(new File(root));
      }
      pb.redirectErrorStream(false);
      process = pb.start();
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
      try (java.io.InputStream procOut = process.getInputStream();
          java.io.InputStream procErr = process.getErrorStream();
          java.io.OutputStream procIn = process.getOutputStream()) {
        // Pump input -> process stdin
        Thread tIn = new Thread(() -> {
          try {
            if (in != null) {
              in.transferTo(procIn);
            }
            procIn.close();
          } catch (IOException ignored) {}
        });
        tIn.setDaemon(true);
        tIn.start();

        // Pump process stdout -> ssh out
        Thread tOut = new Thread(() -> {
          try {
            if (out != null) procOut.transferTo(out);
          } catch (IOException ignored) {}
        });
        tOut.setDaemon(true);
        tOut.start();

        // Pump process stderr -> ssh err
        Thread tErr = new Thread(() -> {
          try {
            if (err != null) procErr.transferTo(err);
          } catch (IOException ignored) {}
        });
        tErr.setDaemon(true);
        tErr.start();

        int code = process.waitFor();
        if (callback != null) callback.onExit(code);
      } catch (Exception e) {
        if (callback != null) callback.onExit(1, e.getMessage());
      }
    }
  }
}
