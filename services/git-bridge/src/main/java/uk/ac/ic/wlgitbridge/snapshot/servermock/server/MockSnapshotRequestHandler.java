package uk.ac.ic.wlgitbridge.snapshot.servermock.server;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.snapshot.servermock.exception.InvalidAPICallException;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.*;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 09/01/15.
 */
public class MockSnapshotRequestHandler extends AbstractHandler {

  private final SnapshotResponseBuilder responseBuilder;

  public MockSnapshotRequestHandler(SnapshotResponseBuilder responseBuilder) {
    this.responseBuilder = responseBuilder;
  }

  @Override
  public void handle(
      String target,
      final Request baseRequest,
      HttpServletRequest request,
      HttpServletResponse response)
      throws IOException, ServletException {
    boolean handled;
    try {
      // Support internal project endpoints used by bridge code in addition to
      // the public /api/v0/docs/ endpoints that our test fixtures provide.
      String effectiveTarget = target;
      if (target != null && target.startsWith("/api/v0/internal/project/")) {
        // rewrite to the docs path so existing test state files work unmodified
        String[] parts = target.split("/");
        String projectName = parts.length >= 6 ? parts[5] : ""; // parts: ['', 'api', 'v0', 'internal', 'project', '<id>']
        effectiveTarget = "/api/v0/docs/" + projectName;
        Log.warn("Rewriting internal project path {} to {}", target, effectiveTarget);
      }

      final SnapshotResponse snapshotResponse =
          responseBuilder.buildWithTarget(effectiveTarget, baseRequest.getMethod());
      response.getWriter().println(snapshotResponse.respond());
      new PostbackThread(baseRequest.getReader(), snapshotResponse.postback()).startIfNotNull();
      handled = true;
    } catch (InvalidAPICallException e) {
      handled = false;
    } catch (RuntimeException e) {
      Log.warn("Runtime exception when handling request", e);
      handled = true;
    }
    baseRequest.setHandled(handled);
  }
}
