package uk.ac.ic.wlgitbridge.server;

import com.google.api.client.auth.oauth2.*;
import com.google.api.client.http.GenericUrl;
import com.google.api.client.http.HttpHeaders;
import com.google.api.client.http.HttpRequest;
import com.google.api.client.http.HttpResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.apache.commons.codec.binary.Base64;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotApi;
import uk.ac.ic.wlgitbridge.util.Instance;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by winston on 25/10/15.
 */
public class Oauth2Filter implements Filter {

  public static final String ATTRIBUTE_KEY = "oauth2";

  private final SnapshotApi snapshotApi;

  private final boolean isUserPasswordEnabled;

  // Telemetry: count permissive token accepts when no local introspect configured
  private static final AtomicLong permissiveAcceptCount = new AtomicLong(0);

  // Expose metric for tests/monitoring
  public static long getPermissiveAcceptCount() { return permissiveAcceptCount.get(); }

  public Oauth2Filter(SnapshotApi snapshotApi, boolean isUserPasswordEnabled) {
    this.snapshotApi = snapshotApi;
    this.isUserPasswordEnabled = isUserPasswordEnabled;
  }

  @Override
  public void init(FilterConfig filterConfig) {}

  /*
   * The original request from git will not contain the Authorization header.
   *
   * So, for projects that need auth, we return 401. Git will swallow this
   * and prompt the user for user/pass, and then make a brand new request.
   *
   * @param servletRequest
   *
   * @param servletResponse
   *
   * @param filterChain
   *
   * @throws IOException
   *
   * @throws ServletException
   */
  @Override
  public void doFilter(
      ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
      throws IOException, ServletException {
    HttpServletRequest request = (HttpServletRequest) servletRequest;
    HttpServletResponse response = (HttpServletResponse) servletResponse;
    String requestUri = request.getRequestURI();

    if (requestUri.startsWith("/project")) {
      Log.info("[{}] Invalid request URI", requestUri);
      sendResponse(
          response, 404, Arrays.asList("Invalid Project ID (must not have a '/project' prefix)"));
      return;
    }

    String projectId = Util.removeAllSuffixes(requestUri.split("/")[1], ".git");

    BasicAuthCredentials basicAuthCreds = getBasicAuthCredentials(request);
    if (basicAuthCreds == null) {
      handleNeedAuthorization(projectId, "(unknown)", request, response);
      return;
    }
    String username = basicAuthCreds.getUsername();
    String password = basicAuthCreds.getPassword();

    if (isLinkSharingId(projectId)) {
      handleLinkSharingId(projectId, username, request, response);
      return;
    }
    if (!isProjectId(projectId)) {
      handleBadProjectId(projectId, username, request, response);
      return;
    }

    // Feature flag: when AUTH_DISABLE_OAUTH or system property auth.disable_oauth
    // is true, skip external OAuth checks and accept the Basic auth password as a
    // Git auth token for username 'git'. Check both environment variable and
    // system property to make testing easier.
    String oauthDisabled = System.getenv("AUTH_DISABLE_OAUTH");
    if (oauthDisabled == null) {
      oauthDisabled = System.getProperty("auth.disable_oauth");
    }
    final Credential cred =
        new Credential.Builder(BearerToken.authorizationHeaderAccessMethod()).build();

    if (oauthDisabled != null && oauthDisabled.equalsIgnoreCase("true")) {
      Log.info("[{}] OAuth disabled via AUTH_DISABLE_OAUTH, skipping oauth checks", projectId);
      if (username.equals("git")) {
        cred.setAccessToken(password);
        servletRequest.setAttribute(ATTRIBUTE_KEY, cred);
        filterChain.doFilter(servletRequest, servletResponse);
        return;
      } else if (this.isUserPasswordEnabled) {
        handlePasswordAuthenticationDeprecation(projectId, username, request, response);
        return;
      } else {
        handleNeedAuthorization(projectId, username, request, response);
        return;
      }
    }

    if (username.equals("git")) {
      Log.debug("[{}] username is 'git', proceeding with token validation", projectId);

      // External OAuth server usage removed. Validation of Git tokens is
      // done via local introspection when configured. If local introspect
      // is not configured, the token will be handled according to the
      // fail-closed configuration (require introspect in prod) or a
      // permissive legacy/dev mode.
      String localIntrospect = System.getenv("AUTH_LOCAL_INTROSPECT_URL");
      // Allow tests and alternate deployment configurations to set via
      // system property too (useful in unit tests)
      if (localIntrospect == null || localIntrospect.isEmpty()) {
        localIntrospect = System.getProperty("auth.local_introspect_url");
      }

      // Read fail-closed flag (env var preferred, fall back to system property)
      String failClosed = System.getenv("AUTH_FAIL_CLOSED");
      if (failClosed == null) {
        failClosed = System.getProperty("auth.fail_closed");
      }

      if (localIntrospect != null && !localIntrospect.isEmpty()) {
        boolean active = false;
        try {
          active = checkLocalIntrospect(localIntrospect, password);
        } catch (Exception e) {
          Log.warn("Local introspect check failed: {}", e.getMessage());
        }
        if (!active) {
          Log.info(String.format("{\"service\":\"git-bridge\",\"project\":\"%s\",\"event\":\"auth.http_attempt\",\"outcome\":\"denied\"}", projectId));
          handleBadAccessToken(projectId, request, response);
          return;
        } else {
          Log.info(String.format("{\"service\":\"git-bridge\",\"project\":\"%s\",\"event\":\"auth.http_attempt\",\"outcome\":\"success\",\"method\":\"local-introspect\"}", projectId));
        }
      } else {
        // No local introspect configured. Decide behavior based on fail-closed.
        if (failClosed != null && failClosed.equalsIgnoreCase("true")) {
          Log.warn("[{}] Fail-closed active but no local introspect configured: denying access", projectId);
          handleBadAccessToken(projectId, request, response);
          return;
        }
        // Telemetry & warning for permissive acceptance (legacy/dev fallback)
        long count = permissiveAcceptCount.incrementAndGet();
        if (count % 100 == 1) { // log once per 100 occurrences to avoid flooding
          Log.warn("[{}] No local introspect configured: accepting token without validation (count={})", projectId, count);
        }
        // Emit a warning header in response to aid observability for proxied clients
        response.addHeader("X-Git-Bridge-Auth-Mode", "permissive");
      }
      cred.setAccessToken(password);
    } else if (this.isUserPasswordEnabled) {
      // password auth has been deprecated for git-bridge
      handlePasswordAuthenticationDeprecation(projectId, username, request, response);
      return;
    } else {
      handleNeedAuthorization(projectId, username, request, response);
      return;
    }

    servletRequest.setAttribute(ATTRIBUTE_KEY, cred);
    filterChain.doFilter(servletRequest, servletResponse);
  }

  @Override
  public void destroy() {}

  private boolean isLinkSharingId(String projectId) {
    return projectId.matches("^[0-9]+[bcdfghjklmnpqrstvwxyz]{6,12}$");
  }

  private boolean isProjectId(String projectId) {
    return projectId.matches("^[0-9a-f]{24}$");
  }

  private void sendResponse(HttpServletResponse response, int code, List<String> lines)
      throws IOException {
    response.setContentType("text/plain");
    response.setStatus(code);
    PrintWriter w = null;
    try {
      w = response.getWriter();
    } catch (Exception e) {
      // servlet container mock may not provide a writer in unit tests
      w = null;
    }
    if (w != null) {
      for (String line : lines) {
        w.println(line);
      }
      w.close();
    } else {
      // Fallback to writing raw bytes to output stream when writer unavailable
      try {
        javax.servlet.ServletOutputStream os = response.getOutputStream();
        for (String line : lines) {
          os.write((line + System.lineSeparator()).getBytes());
        }
        os.flush();
      } catch (Exception ignored) {
        // Best effort; if this also fails, don't throw during error handling
      }
    }
  }

  private void handleLinkSharingId(
      String projectId, String username, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    Log.info("[{}] Bad project id, User '{}' ip={}", projectId, username, getClientIp(request));
    sendResponse(
        response,
        404,
        Arrays.asList(
            "Git access via link sharing link is not supported.",
            "",
            "You can find the project's git remote url by opening it in your browser",
            "and selecting Git from the left sidebar in the project view.",
            "",
            "If this is unexpected, please contact us at support@overleaf.com, or",
            "see https://www.overleaf.com/learn/how-to/Git_integration for more information."));
  }

  private void handleBadProjectId(
      String projectId, String username, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    Log.info("[{}] Bad project id, User '{}' ip={}", projectId, username, getClientIp(request));
    sendResponse(
        response,
        404,
        Arrays.asList(
            "This Overleaf project does not exist.",
            "",
            "If this is unexpected, please contact us at support@overleaf.com, or",
            "see https://www.overleaf.com/learn/how-to/Git_integration for more information."));
  }

  private void handleRateLimit(
      String projectId, String username, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    Log.info("[{}] Rate limit, User '{}' ip={}", projectId, username, getClientIp(request));
    sendResponse(
        response, 429, Arrays.asList("Rate limit exceeded. Please wait and try again later."));
  }

  private void handleNeedAuthorization(
      String projectId, String username, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    Log.info("[{}] Unauthorized, User '{}' ip={}", projectId, username, getClientIp(request));
    response.setHeader("WWW-Authenticate", "Basic realm=\"Git Bridge\"");
    if (this.isUserPasswordEnabled) {
      sendResponse(
          response,
          401,
          Arrays.asList(
              "Log in using the email address and password you use for Overleaf.",
              "",
              "*Note*: if you use a provider such as Google or Twitter to sign into",
              "your Overleaf account, you will need to set a password.",
              "",
              "See our help page for more support:",
              "https://www.overleaf.com/learn/how-to/Troubleshooting_git_bridge_problems"));
    } else {
      sendResponse(
          response,
          401,
          Arrays.asList(
              "Log in with the username 'git' and enter your Git authentication token",
              "when prompted for a password.",
              "",
              "You can generate and manage your Git authentication tokens in",
              "your Overleaf Account Settings."));
    }
  }

  private void handleBadAccessToken(
      String projectId, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    Log.info("[{}] Bad access token, ip={}", projectId, getClientIp(request));
    sendResponse(
        response,
        401,
        Arrays.asList(
            "Enter your Git authentication token when prompted for a password.",
            "",
            "You can generate and manage your Git authentication tokens in",
            "your Overleaf Account Settings."));
  }

  private boolean checkLocalIntrospect(String introspectUrl, String token) throws IOException {
    GenericUrl url = new GenericUrl(introspectUrl);
    HttpRequest request = Instance.httpRequestFactory.buildPostRequest(url, null);
    request.setThrowExceptionOnExecuteError(false);
    request.getHeaders().setContentType("application/json");
    // If a service token is configured for internal API access, use it as Basic auth
    String serviceToken = System.getenv("WEB_PROFILE_API_TOKEN");
    if (serviceToken != null && !serviceToken.isEmpty()) {
      String basic = org.apache.commons.codec.binary.Base64.encodeBase64String(serviceToken.getBytes());
      request.getHeaders().setAuthorization("Basic " + basic);
    }
    String body = String.format("{\"token\":\"%s\"}", token.replace("\"","\\\""));
    request.setContent(new com.google.api.client.http.ByteArrayContent("application/json", body.getBytes()));
    HttpResponse response = request.execute();
    int status = response.getStatusCode();
    if (status >= 200 && status < 300) {
      String json = response.parseAsString();
      // Quick check for "active":true to avoid pulling in a full JSON parser here
      return json.contains("\"active\":true");
    }
    return false;
  }

  private void handlePasswordAuthenticationDeprecation(
      String projectId, String username, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    if (username.contains("@")) {
      Log.info("[{}] Password authentication deprecated, ip={}", projectId, getClientIp(request));
      sendResponse(
          response,
          403,
          Arrays.asList(
              "Overleaf now only supports Git authentication tokens to access git. See: https://www.overleaf.com/learn/how-to/Git_integration_authentication_tokens"));
    } else {
      Log.info("[{}] Wrong git URL format, ip={}", projectId, getClientIp(request));
      sendResponse(
          response,
          403,
          Arrays.asList(
              "Overleaf now only supports Git authentication tokens to access git. See: https://www.overleaf.com/learn/how-to/Git_integration_authentication_tokens",
              "Please make sure your Git URL is correctly formatted. For example: https://git@git.overleaf.com/<YOUR_PROJECT_ID> or https://git:<AUTHENTICATION_TOKEN>@git.overleaf.com/<YOUR_PROJECT_ID>"));
    }
  }

  /*
   * Gets the remote IP from the request.
   */
  private String getClientIp(HttpServletRequest request) {
    String clientIp = request.getHeader("X-Forwarded-For");
    if (clientIp == null) {
      clientIp = request.getRemoteAddr();
    }
    return clientIp;
  }

  /*
   * Extract basic auth credentials from the request.
   *
   * Returns null if valid basic auth credentials couldn't be found.
   */
  private BasicAuthCredentials getBasicAuthCredentials(HttpServletRequest request) {
    String authHeader = request.getHeader("Authorization");
    if (authHeader == null) {
      return null;
    }

    StringTokenizer st = new StringTokenizer(authHeader);
    if (!st.hasMoreTokens()) {
      return null;
    }
    String basic = st.nextToken();
    if (!basic.equalsIgnoreCase("Basic")) {
      return null;
    }

    String credentials = null;
    try {
      credentials = new String(Base64.decodeBase64(st.nextToken()), "UTF-8");
    } catch (UnsupportedEncodingException e) {
      return null;
    }

    String[] split = credentials.split(":", 2);
    if (split.length != 2) {
      return null;
    }
    String username = split[0];
    String password = split[1];
    return new BasicAuthCredentials(username, password);
  }
}
