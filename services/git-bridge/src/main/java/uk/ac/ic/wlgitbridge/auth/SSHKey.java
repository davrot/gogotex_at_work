package uk.ac.ic.wlgitbridge.auth;

import java.time.Instant;

/**
 * Simple representation of a user's SSH public key metadata.
 */
public class SSHKey {
    private String id;
    private String userId;
    private String keyName;
    private String publicKey;
    private String privateKeyHash;
    private Instant createdAt;
    private Instant updatedAt;

    public SSHKey() {}

    public SSHKey(String id, String userId, String keyName, String publicKey) {
        this.id = id;
        this.userId = userId;
        this.keyName = keyName;
        this.publicKey = publicKey;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public String getKeyName() { return keyName; }
    public String getPublicKey() { return publicKey; }
    public String getPrivateKeyHash() { return privateKeyHash; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setId(String id) { this.id = id; }
    public void setUserId(String userId) { this.userId = userId; }
    public void setKeyName(String keyName) { this.keyName = keyName; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }
    public void setPrivateKeyHash(String privateKeyHash) { this.privateKeyHash = privateKeyHash; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
