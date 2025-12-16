package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.http.HttpRequest;
import java.io.UnsupportedEncodingException;

/*
 * Created by Winston on 06/11/14.
 */
public abstract class SnapshotAPIRequest<T extends Result> extends Request<T> {

  private static String BASE_URL;

  private final Credential oauth2;

  public SnapshotAPIRequest(String projectName, String apiCall, Credential oauth2) {
    super(BASE_URL + projectName + apiCall);
    this.oauth2 = oauth2;
  }

  @Override
  protected void onBeforeRequest(HttpRequest request) {
    // If a local service token is configured (e.g., WEB_PROFILE_API_TOKEN),
    // prefer it and attach it as Basic auth so the internal API endpoints
    // (which expect service Basic auth) will accept requests originating
    // from the bridge. If no service token is configured, fall back to
    // attaching an OAuth2 Bearer token if provided.
    String serviceToken = System.getenv("WEB_PROFILE_API_TOKEN");
    if (serviceToken != null && !serviceToken.isEmpty()) {
      try {
        String basic = org.apache.commons.codec.binary.Base64.encodeBase64String(serviceToken.getBytes("UTF-8"));
        request.getHeaders().setAuthorization("Basic " + basic);
      } catch (UnsupportedEncodingException e) {
        // ignore encoding errors and proceed without service auth
      }
    } else if (oauth2 != null) {
      request.setInterceptor(
          request1 -> {
            oauth2.intercept(request1);
          });
    }
  }

  /* baseURL ends with / */
  public static void setBaseURL(String baseURL) {
    BASE_URL = baseURL + "docs/";
  }

  /* Return the raw API base (without the 'docs/' suffix) */
  public static String getApiBase() {
    if (BASE_URL == null) return null;
    if (BASE_URL.endsWith("docs/")) {
      return BASE_URL.substring(0, BASE_URL.length() - "docs/".length());
    }
    return BASE_URL;
  }
}
