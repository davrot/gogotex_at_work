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

  useEffect(()=>{ fetchKeys(); }, []);

  function validatePublicKey(pk:string){
    const re = /^ssh-(rsa|ed25519|ecdsa) [A-Za-z0-9+/=]+(?: .*)?$/;
    return re.test(pk.trim());
  }

  async function fetchKeys(){
    try{
      const data = await getJSON(`/internal/api/users/${userId}/ssh-keys`)
      setKeys(Array.isArray(data) ? data : [])
    }catch(e){
      console.error(e)
      setError(getUserFacingMessage(e as any) ?? String(e))
    }
  }

  async function addKey(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!validatePublicKey(publicKey)) { setError('Invalid OpenSSH public key format'); return; }
    try{
      await postJSON(`/internal/api/users/${userId}/ssh-keys`, { body: { label, public_key: publicKey } })
      setLabel(''); setPublicKey(''); await fetchKeys();
    }catch(err){
      console.error(err)
      setError(getUserFacingMessage(err as any) ?? String(err))
    }
  }

  async function deleteKey(id:string){
    if(!confirm('Delete this SSH key?')) return;
    try{
      await deleteJSON(`/internal/api/users/${userId}/ssh-keys/${id}`)
      await fetchKeys()
    }catch(err){
      console.error(err)
      setError(getUserFacingMessage(err as any) ?? String(err))
    }
  }

  return (
    <div className="ssh-keys-panel">
      <h2>SSH Keys</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={addKey}>
        <label>
          Label
          <input value={label} onChange={e=>setLabel(e.target.value)} maxLength={64} />
        </label>
        <label>
          Public Key
          <textarea value={publicKey} onChange={e=>setPublicKey(e.target.value)} rows={4} />
        </label>
        <button type="submit">Add SSH key</button>
      </form>

      <h3>Your keys</h3>
      {keys.length===0 ? <p>No SSH keys yet.</p> : (
        <table>
          <thead><tr><th>Label</th><th>Fingerprint</th><th>Added</th><th>Actions</th></tr></thead>
          <tbody>
            {keys.map(k=> (
              <tr key={k.id}>
                <td>{k.label}</td>
                <td>{k.fingerprint}</td>
                <td>{k.created_at}</td>
                <td><button onClick={()=>deleteKey(k.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
