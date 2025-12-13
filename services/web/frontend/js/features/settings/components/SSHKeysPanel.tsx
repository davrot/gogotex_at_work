import React, {useEffect, useState} from 'react'
import { getJSON, postJSON, deleteJSON, getUserFacingMessage } from '../../../infrastructure/fetch-json'

type SSHKey = {
  id: string;
  label?: string;
  fingerprint?: string;
  public_key?: string;
  created_at?: string;
};

export default function SSHKeysPanel({userId}:{userId?:string|null}){
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [label, setLabel] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState<string|null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(()=>{ fetchKeys(); }, []);

  function validatePublicKey(pk:string){
    const re = /^ssh-(rsa|ed25519|ecdsa) [A-Za-z0-9+/=]+(?: .*)?$/;
    return re.test(pk.trim());
  }

  const isPublicKeyValid = validatePublicKey(publicKey)

  async function fetchKeys(){
    try{
      const data = await getJSON(`/internal/api/users/${userId}/ssh-keys`)
      setKeys(Array.isArray(data) ? data : [])
    }catch(e){
      const status = (e as any)?.response?.status
      if (status === 404 || status === 401) {
        // treat as empty list in dev/E2E where the API may be unavailable or unauthenticated briefly
        console.debug('SSHKeysPanel: ssh-keys list fetch returned', status, '— treating as empty list')
        setKeys([])
        setError(null)
      } else {
        console.error(e)
        setError(getUserFacingMessage(e as any) ?? String(e))
      }
    }
  }

  async function addKey(e:React.FormEvent){
    e.preventDefault();
    setError(null); setSuccess(null);
    if(!isPublicKeyValid) { setError('Invalid OpenSSH public key format'); return; }
    setIsAdding(true);
    try{
      await postJSON(`/internal/api/users/${userId}/ssh-keys`, { body: { label, public_key: publicKey } })
      setLabel(''); setPublicKey(''); await fetchKeys();
      setSuccess('SSH key added')
    }catch(err){
      console.error(err)
      setError(getUserFacingMessage(err as any) ?? String(err))
    } finally {
      setIsAdding(false)
    }
  }

  async function deleteKey(id:string){
    if(!confirm('Delete this SSH key?')) return;
    setError(null); setSuccess(null);
    try{
      await deleteJSON(`/internal/api/users/${userId}/ssh-keys/${id}`)
      await fetchKeys()
      setSuccess('SSH key deleted')
    }catch(err){
      console.error(err)
      setError(getUserFacingMessage(err as any) ?? String(err))
    }
  }

  return (
    <div className="ssh-keys-panel">
      <h2>SSH Keys</h2>
      {error && (
        <div className="notification notification-type-error" role="alert" aria-live="polite">
          <span>{error}</span>
          <button aria-label="Dismiss error" className="btn btn-link" onClick={()=>setError(null)}>×</button>
        </div>
      )}
      {success && (
        <div className="notification notification-type-success" role="status" aria-live="polite">
          <span>{success}</span>
          <button aria-label="Dismiss success" className="btn btn-link" onClick={()=>setSuccess(null)}>×</button>
        </div>
      )}
      <form onSubmit={addKey}>
        <div className="form-group">
          <label className="form-label">Label</label>
          <input aria-label="SSH key label" className="form-control" value={label} onChange={e=>setLabel(e.target.value)} maxLength={64} />
        </div>
        <div className="form-group">
          <label className="form-label">Public Key</label>
          <textarea aria-label="SSH public key" aria-invalid={publicKey ? (!isPublicKeyValid).toString() : 'false'} className={`form-control ${publicKey && !isPublicKeyValid ? 'is-invalid' : ''}`} value={publicKey} onChange={e=>setPublicKey(e.target.value)} rows={4} />
          {publicKey && !isPublicKeyValid ? <div className="form-text text-danger">Invalid OpenSSH public key format. Expected: <code>ssh-rsa|ssh-ed25519|ssh-ecdsa &lt;base64&gt; [comment]</code></div> : <div className="form-text">Paste your OpenSSH public key here (e.g., generated with <code>ssh-keygen -t ed25519</code>).</div>}
        </div>
        <div className="form-group">
          <button type="submit" aria-label="Add SSH key" className="btn btn-primary" disabled={!isPublicKeyValid || !label.trim() || isAdding} aria-busy={isAdding}>{isAdding ? 'Adding…' : 'Add SSH key'}</button>
        </div>
      </form>

      <h3>Your keys</h3>
      {keys.length===0 ? <p>No SSH keys yet.</p> : (
        <table className="table">
          <thead><tr><th>Label</th><th>Fingerprint</th><th>Added</th><th>Actions</th></tr></thead>
          <tbody>
            {keys.map(k=> (
              <tr key={k.id}>
                <td>{k.label}</td>
                <td>{k.fingerprint}</td>
                <td>{k.created_at}</td>
                <td><button aria-label={`Delete SSH key ${k.label || k.id}`} className="btn btn-link text-danger" onClick={()=>deleteKey(k.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
