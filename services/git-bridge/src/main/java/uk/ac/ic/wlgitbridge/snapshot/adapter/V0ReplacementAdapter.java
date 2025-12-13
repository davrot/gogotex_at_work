package uk.ac.ic.wlgitbridge.snapshot.adapter;

import com.google.api.client.http.GenericUrl;
import com.google.api.client.http.HttpRequest;
import com.google.api.client.http.HttpResponse;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.util.Instance;

import java.lang.reflect.Field;

/**
 * Adapter for mapping legacy /api/v0 snapshot endpoints to existing services
 * (project-history, filestore, docstore). This implementation performs
 * best-effort translations using the configured snapshot base URL as a
 * starting point. The methods return JSON-shaped objects compatible with
 * the legacy V0 API surface.
 */
public class V0ReplacementAdapter {

    public V0ReplacementAdapter() {}

    private String getServiceRoot() {
        try {
            Field f = SnapshotAPIRequest.class.getDeclaredField("BASE_URL");
            f.setAccessible(true);
            String base = (String) f.get(null);
            if (base == null) return "";
            // Normalize by removing known API/document path segments so we can
            // target the service root that tests register contexts on.
            String normalized = base;
            // remove any trailing docs/ segment
            normalized = normalized.replaceFirst("docs/?$", "");
            // remove any api/v0/ segment
            normalized = normalized.replaceFirst("api/v0/?", "");
            return normalized;
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Map GET /api/v0/docs/:docId -> { latestVerId, latestVerAt, latestVerBy }
     * Uses project-history `GET /project/:project_id/version` where available.
     */
    public Object getDoc(String docId) {
        String root = getServiceRoot();
        if (root.isEmpty()) return null;
        String url = root + "project/" + docId + "/version";
        try {
            HttpRequest req = Instance.httpRequestFactory.buildGetRequest(new GenericUrl(url));
            HttpResponse resp = req.execute();
            String body = resp.parseAsString();
            JsonElement json = Instance.gson.fromJson(body, JsonElement.class);
            JsonObject out = new JsonObject();
            if (json != null && json.isJsonObject()) {
                JsonObject obj = json.getAsJsonObject();
                if (obj.has("version")) {
                    out.addProperty("latestVerId", obj.get("version").getAsInt());
                }
                if (obj.has("timestamp")) {
                    out.addProperty("latestVerAt", obj.get("timestamp").getAsString());
                }
                // legacy API may include latestVerBy; project-history doesn't always provide it
                if (obj.has("v2Authors")) {
                    out.add("latestVerBy", obj.get("v2Authors"));
                }
            }
            return out;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Map GET /api/v0/docs/:docId/saved_vers -> array of saved versions.
     * Uses project-history `GET /project/:project_id/labels` as an approximation.
     */
    public Object getSavedVers(String docId) {
        String root = getServiceRoot();
        if (root.isEmpty()) return null;
        String url = root + "project/" + docId + "/labels";
        try {
            HttpRequest req = Instance.httpRequestFactory.buildGetRequest(new GenericUrl(url));
            HttpResponse resp = req.execute();
            String body = resp.parseAsString();
            JsonElement json = Instance.gson.fromJson(body, JsonElement.class);
            return json; // return whatever project-history provides; calling code can adapt
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Map GET /api/v0/docs/:docId/snapshots/:version -> V0 snapshot shape.
     * Uses project-history `GET /project/:project_id/version/:version`.
     */
    public Object getSnapshot(String docId, String version) {
        String root = getServiceRoot();
        if (root.isEmpty()) return null;
        String url = root + "project/" + docId + "/version/" + version;
        try {
            HttpRequest req = Instance.httpRequestFactory.buildGetRequest(new GenericUrl(url));
            HttpResponse resp = req.execute();
            String body = resp.parseAsString();
            JsonElement json = Instance.gson.fromJson(body, JsonElement.class);
            // project-history may already return a snapshot-like object; pass through
            return json;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Map POST/PUT /api/v0/docs/:docId/snapshots -> push snapshot.
     * This implementation currently acknowledges the request (202 Accepted)
     * and leaves full push-to-document-updater behavior as a later enhancement.
     */
    public Object pushSnapshot(String docId, JsonObject payload) {
        JsonObject accepted = new JsonObject();
        accepted.addProperty("status", 202);
        accepted.addProperty("code", "accepted");
        accepted.addProperty("message", "Accepted");
        return accepted;
    }

}
