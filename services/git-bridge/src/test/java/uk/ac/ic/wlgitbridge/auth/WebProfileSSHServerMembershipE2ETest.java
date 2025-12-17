package uk.ac.ic.wlgitbridge.auth;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ClientChannel;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

public class WebProfileSSHServerMembershipE2ETest {

  private HttpServer server;
  private HttpServer membershipServer;
  private int port;
  private int membershipPort;

  private final Map<String, List<Map<String, String>>> userKeys = new ConcurrentHashMap<>();
  private final Map<String, String> fpToUser = new ConcurrentHashMap<>();
  private final Gson gson = new Gson();

  @Before
  public void startServers() throws Exception {
    // WebProfile-like server
    server = HttpServer.create(new InetSocketAddress(0), 0);
    port = server.getAddress().getPort();

    server.createContext("/internal/api/users/", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        URI uri = exchange.getRequestURI();
        String path = uri.getPath();
        if (!path.startsWith("/internal/api/users/") || !path.endsWith("/ssh-keys")) {
          exchange.sendResponseHeaders(404, -1);
          return;
        }
        String[] parts = path.split("/");
        if (parts.length < 5) { exchange.sendResponseHeaders(400, -1); return; }
        String userId = parts[4];
        if ("POST".equals(exchange.getRequestMethod())) {
          try (var is = exchange.getRequestBody()) {
            String body = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            JsonObject j = gson.fromJson(body, JsonObject.class);
            String id = j.has("id") ? j.get("id").getAsString() : UUID.randomUUID().toString();
            String publicKey = j.has("publicKey") ? j.get("publicKey").getAsString() : null;
            if (publicKey == null) { exchange.sendResponseHeaders(400, -1); return; }
            Map<String,String> rec = new HashMap<>(); rec.put("id", id); rec.put("publicKey", publicKey);
            userKeys.computeIfAbsent(userId, k -> Collections.synchronizedList(new ArrayList<>())).add(rec);
            String fp = SSHAuthManager.fingerprintOpenSSH(publicKey);
            if (fp != null && !fp.isEmpty()) fpToUser.put("SHA256:" + fp, userId);
            String resp = gson.toJson(rec);
            exchange.getResponseHeaders().add("Content-Type","application/json");
            byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(201, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
          }
          return;
        }
        if ("GET".equals(exchange.getRequestMethod())) {
          List<Map<String,String>> l = userKeys.getOrDefault(userId, Collections.emptyList());
          String resp = gson.toJson(l);
          exchange.getResponseHeaders().add("Content-Type","application/json");
          byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, bytes.length);
          try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
          return;
        }
        exchange.sendResponseHeaders(405, -1);
      }
    });

    server.createContext("/internal/api/ssh-keys/", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String[] parts = path.split("/ssh-keys/");
        if (parts.length != 2) { exchange.sendResponseHeaders(404, -1); return; }
        String fingerprint = parts[1];
        String user = fpToUser.get(fingerprint);
        if (user == null) { exchange.sendResponseHeaders(404, -1); return; }
        String resp = gson.toJson(Collections.singletonMap("userId", user));
        exchange.getResponseHeaders().add("Content-Type","application/json");
        byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
      }
    });

    server.start();

    // membership server that always 404s for members endpoint
    membershipServer = HttpServer.create(new InetSocketAddress(0), 0);
    membershipPort = membershipServer.getAddress().getPort();
    membershipServer.createContext("/internal/api/projects/", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        // always return 404 -> not a member
        exchange.sendResponseHeaders(404, -1);
      }
    });
    membershipServer.start();

    // Ensure small delay
    try { Thread.sleep(50); } catch (InterruptedException ignored) {}
  }

  @After
  public void stopServers() {
    if (server != null) server.stop(0);
    if (membershipServer != null) membershipServer.stop(0);
    userKeys.clear(); fpToUser.clear();
  }

  @Test
  public void sshRpcDeniedWhenNotAMember() throws Exception {
    String baseUrl = "http://localhost:" + port;
    String userId = "user-member-e2e";

    // generate key
    KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
    kpg.initialize(2048);
    KeyPair kp = kpg.generateKeyPair();
    String b64 = Base64.getEncoder().encodeToString(kp.getPublic().getEncoded());
    String publicKey = "ssh-rsa " + b64 + " e2e@example.com";

    // register key
    java.net.URL url = new java.net.URL(baseUrl + "/internal/api/users/" + userId + "/ssh-keys");
    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
    conn.setDoOutput(true); conn.setRequestMethod("POST"); conn.setRequestProperty("Content-Type","application/json");
    JsonObject body = new JsonObject(); body.addProperty("id","k-e2e"); body.addProperty("publicKey", publicKey);
    byte[] out = body.toString().getBytes(StandardCharsets.UTF_8);
    conn.setFixedLengthStreamingMode(out.length); conn.connect(); try (OutputStream os = conn.getOutputStream()) { os.write(out); }
    Assert.assertEquals(201, conn.getResponseCode());

    WebProfileClient client = new WebProfileClient(baseUrl, null);
    SSHAuthManager auth = new SSHAuthManager(client);

    // Configure membership lookup to point to our membershipServer
    System.setProperty("MEMBERSHIP_API_BASE_URL", "http://localhost:" + membershipPort);

    java.nio.file.Path tmp = Files.createTempDirectory("ssh-member-e2e");
    SSHServerManager ssh = new SSHServerManager(0, auth, null, null, tmp.toAbsolutePath().toString());
    ssh.start();
    int portUsed = ssh.getListeningPort();

    try (SshClient clientSsh = SshClient.setUpDefaultClient()) {
      clientSsh.start();
      try (ClientSession session = clientSsh.connect(userId, "localhost", portUsed).verify(5000).getSession()) {
        session.addPublicKeyIdentity(kp);
        session.auth().verify(5000);
        try (ClientChannel ch = session.createExecChannel("git-receive-pack 'repo.git'")) {
          ch.open().verify(5000);
          ch.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), TimeUnit.SECONDS.toMillis(5));
          Integer exit = ch.getExitStatus();
          // Expect non-zero exit or null exit considered failure for our purposes
          Assert.assertTrue("Expected git RPC to be denied (non-zero exit)", exit == null || exit != 0);
        }
      }
      clientSsh.stop();
    } finally {
      ssh.stop();
      Files.walk(tmp).sorted(Comparator.reverseOrder()).forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) {} });
      System.clearProperty("MEMBERSHIP_API_BASE_URL");
    }
  }
}
