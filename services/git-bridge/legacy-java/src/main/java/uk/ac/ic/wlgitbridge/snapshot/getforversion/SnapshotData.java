package uk.ac.ic.wlgitbridge.snapshot.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;
import uk.ac.ic.wlgitbridge.snapshot.base.JSONSource;

/*
 * Created by Winston on 06/11/14.
 */
public class SnapshotData implements JSONSource {

  public static final String JSON_KEY_SRCS = "srcs";
  public static final String JSON_KEY_ATTS = "atts";

  private List<SnapshotFile> srcs;
  private List<SnapshotAttachment> atts;

  public SnapshotData(JsonElement json) {
    srcs = new ArrayList<>();
    atts = new ArrayList<>();
    fromJSON(json);
  }

  public SnapshotData(List<SnapshotFile> srcs, List<SnapshotAttachment> atts) {
    this.srcs = srcs;
    this.atts = atts;
  }

  @Override
  public String toString() {
    return "SnapshotData(srcs: " + srcs + ", atts: " + atts + ")";
  }

  public JsonElement toJson() {
    JsonObject jsonThis = new JsonObject();
    JsonArray jsonSrcs = new JsonArray();
    for (SnapshotFile src : srcs) {
      jsonSrcs.add(src.toJson());
    }
    jsonThis.add("srcs", jsonSrcs);
    JsonArray jsonAtts = new JsonArray();
    for (SnapshotAttachment att : atts) {
      jsonAtts.add(att.toJson());
    }
    jsonThis.add("atts", jsonAtts);
    return jsonThis;
  }

  @Override
  public void fromJSON(JsonElement json) {
    JsonObject obj = json.getAsJsonObject();
    if (obj.has(JSON_KEY_SRCS) && obj.get(JSON_KEY_SRCS) != null && obj.get(JSON_KEY_SRCS).isJsonArray()) {
      populateSrcs(obj.get(JSON_KEY_SRCS).getAsJsonArray());
    } else {
      // No sources -> empty list
      srcs = new ArrayList<>();
    }

    if (obj.has(JSON_KEY_ATTS) && obj.get(JSON_KEY_ATTS) != null && obj.get(JSON_KEY_ATTS).isJsonArray()) {
      populateAtts(obj.get(JSON_KEY_ATTS).getAsJsonArray());
    } else {
      // No attachments -> empty list
      atts = new ArrayList<>();
    }
  }

  private void populateSrcs(JsonArray jsonArray) {
    for (JsonElement json : jsonArray) {
      srcs.add(new SnapshotFile(json));
    }
  }

  private void populateAtts(JsonArray jsonArray) {
    for (JsonElement json : jsonArray) {
      atts.add(new SnapshotAttachment(json));
    }
  }

  public List<SnapshotFile> getSrcs() {
    return srcs;
  }

  public List<SnapshotAttachment> getAtts() {
    return atts;
  }
}
