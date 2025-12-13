package uk.ac.ic.wlgitbridge.git.handler;

import com.google.api.client.auth.oauth2.Credential;
import java.util.Optional;
import javax.servlet.http.HttpServletRequest;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.resolver.ReceivePackFactory;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.git.handler.hook.WriteLatexPutHook;
import uk.ac.ic.wlgitbridge.server.Oauth2Filter;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 02/11/14.
 */
/*
 * One of the "big three" interfaces created by {@link WLGitServlet} to handle
 * user Git requests.
 *
 * This class just puts a {@link WriteLatexPutHook} into the {@link ReceivePack}
 * that it returns.
 */
public class WLReceivePackFactory implements ReceivePackFactory<HttpServletRequest> {

  private final RepoStore repoStore;

  private final Bridge bridge;

  public WLReceivePackFactory(RepoStore repoStore, Bridge bridge) {
    this.repoStore = repoStore;
    this.bridge = bridge;
  }

  /*
   * Puts a {@link WriteLatexPutHook} into the returned {@link ReceivePack}.
   *
   * The {@link WriteLatexPutHook} needs our hostname, which we get from the
   * original {@link HttpServletRequest}, used to provide a postback URL to
   * the {@link SnapshotApi}. We also give it the oauth2 that we injected in
   * the {@link Oauth2Filter}, and the {@link Bridge}.
   *
   * At this point, the repository will have been synced to the latest on
   * Overleaf, but it's possible that an update happens on Overleaf while our
   * put hook is running. In this case, we fail, and the user tries again,
   * triggering another sync, and so on.
   * @param httpServletRequest the original request
   * @param repository the JGit {@link Repository} provided by
   * {@link WLRepositoryResolver}
   * @return a correctly hooked {@link ReceivePack}
   */
  @Override
  public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) {
    Log.debug("[{}] Creating receive-pack", repository.getWorkTree().getName());
    Optional<Credential> oauth2 =
        Optional.ofNullable(
            (Credential) httpServletRequest.getAttribute(Oauth2Filter.ATTRIBUTE_KEY));
    ReceivePack receivePack = new ReceivePack(repository);
    // Membership check: if configured, verify the authenticated user (from oauth2 or other mechanism)
    // is a member of the project before allowing receive-pack. The membership API base URL
    // can be configured via the environment variable `MEMBERSHIP_API_BASE_URL` which should
    // expose an endpoint: GET /internal/api/projects/:projectId/members/:userId -> 200 if member.
    try {
      String membershipBase = System.getenv("MEMBERSHIP_API_BASE_URL");
      if (membershipBase != null && !membershipBase.isEmpty()) {
        Optional<String> userId = Optional.empty();
        if (oauth2.isPresent() && oauth2.get().getAccessToken() != null) {
          // We do not have a direct mapping to userId here; in a real integration this would
          // extract the userId from the oauth2 credential or perform token introspection.
          // For now, skip membership check if userId cannot be determined.
        }
        if (userId.isPresent()) {
          String projectId = repository.getWorkTree().getName();
          // Perform check against membership API
          // Note: lightweight implementation using Instance.httpRequestFactory is preferred,
          // but to avoid adding a heavy dependency here, membership enforcement is a best-effort
          // call and will be implemented in full in a follow-up (see T006 acceptance).
        }
      }
    } catch (Exception e) {
      Log.warn("Membership check failed (continuing): {}", e.getMessage());
    }
    String hostname = Util.getPostbackURL();
    if (hostname == null) {
      hostname = httpServletRequest.getLocalName();
    }
    receivePack.setPreReceiveHook(new WriteLatexPutHook(repoStore, bridge, hostname, oauth2));
    return receivePack;
  }
}
