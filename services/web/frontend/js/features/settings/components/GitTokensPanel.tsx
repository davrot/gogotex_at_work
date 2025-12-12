import React, { useEffect, useState } from 'react'
import { getJSON, postJSON, deleteJSON, getUserFacingMessage } from '../../../infrastructure/fetch-json'

type Token = {
  id: string;
  label?: string;
  scopes?: string[];
  active?: boolean;
  hashPrefix?: string;
  createdAt?: string;
  expiresAt?: string | null;
}

export default function GitTokensPanel({ userId }: { userId?: string | null }){
  const [tokens, setTokens] = useState<Token[]>([])
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [newToken, setNewToken] = useState<string|null>(null)

  useEffect(()=>{ fetchTokens() }, [])

  async function fetchTokens(){
    setError(null)
    try{
      const data = await getJSON(`/internal/api/users/${userId}/git-tokens`)
      setTokens(Array.isArray(data) ? data : [])
    }catch(e){
      setError(getUserFacingMessage(e as any) ?? String(e))
    }
  }

  async function createToken(e: React.FormEvent){
    e.preventDefault()
    setError(null)
    setNewToken(null)
    try{
      const res = await postJSON(`/internal/api/users/${userId}/git-tokens`, { body: { label } })
      // API returns { id, token, accessTokenPartial }
      setNewToken(res.token || null)
      setLabel('')
      await fetchTokens()
    }catch(err){
      setError(getUserFacingMessage(err as any) ?? String(err))
    }
  }

  async function revokeToken(id: string){
    if(!confirm('Revoke this token?')) return
    try{
      await deleteJSON(`/internal/api/users/${userId}/git-tokens/${id}`)
      await fetchTokens()
    }catch(err){
      setError(getUserFacingMessage(err as any) ?? String(err))
    }
  }

  return (
    <div className="git-tokens-panel">
      <h2>Personal Access Tokens</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={createToken}>
        <label>
          Label
          <input value={label} onChange={e=>setLabel(e.target.value)} maxLength={64} />
        </label>
        <button type="submit">Create Token</button>
      </form>

      {newToken ? (
        <div className="new-token">
          <p>Copy this token now — it will be shown only once.</p>
          <pre style={{whiteSpace: 'break-spaces'}}>{newToken}</pre>
        </div>
      ) : null}

      <h3>Your tokens</h3>
      {tokens.length===0 ? <p>No tokens yet.</p> : (
        <table>
          <thead><tr><th>Label</th><th>Scopes</th><th>Prefix</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {tokens.map(t=> (
              <tr key={t.id}>
                <td>{t.label}</td>
                <td>{(t.scopes||[]).join(', ')}</td>
                <td>{t.hashPrefix}</td>
                <td>{t.createdAt}</td>
                <td><button onClick={()=>revokeToken(t.id)}>Revoke</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
