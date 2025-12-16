package uk.ac.ic.wlgitbridge.snapshot.getdoc;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.http.HttpRequest;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.snapshot.base.HTTPMethod;
import uk.ac.ic.wlgitbridge.snapshot.base.Request;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 06/11/14.
 */
public class GetDocRequest extends Request<GetDocResult> {

  public static final String API_CALL = "";

  private final Credential oauth2;

  public GetDocRequest(Credential oauth2, String projectName) {
    super(SnapshotAPIRequest.getApiBase() + "internal/project/" + projectName);
    this.oauth2 = oauth2;
    Log.debug("GetDocRequest({}, {})", "oauth2: <oauth2>", "projectName: " + projectName);
  }

  public GetDocRequest(String projectName) {
    this(null, projectName);
  }

  @Override
  protected void onBeforeRequest(HttpRequest request) {
    String serviceToken = System.getenv("WEB_PROFILE_API_TOKEN");
    if (serviceToken != null && !serviceToken.isEmpty()) {
      try {
        String basic = org.apache.commons.codec.binary.Base64.encodeBase64String(serviceToken.getBytes("UTF-8"));
        request.getHeaders().setAuthorization("Basic " + basic);
      } catch (java.io.UnsupportedEncodingException e) {
        // ignore and fall back to oauth2 if available
        if (oauth2 != null) {
          request.setInterceptor(request1 -> {
            oauth2.intercept(request1);
          });
        }
      }
    } else if (oauth2 != null) {
      request.setInterceptor(request1 -> {
        oauth2.intercept(request1);
      });
    }
  }

  @Override
  protected HTTPMethod httpMethod() {
    return HTTPMethod.GET;
  }

  @Override
  protected GetDocResult parseResponse(JsonElement json) throws FailedConnectionException {
    return new GetDocResult(this, json);
  }
}
