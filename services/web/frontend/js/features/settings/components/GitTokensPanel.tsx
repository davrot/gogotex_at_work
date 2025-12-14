import React, { useEffect, useState } from 'react'
import { getJSON, postJSON, deleteJSON, getUserFacingMessage } from '../../../infrastructure/fetch-json'
import getMeta from '@/utils/meta'
import { useUserContext } from '@/shared/context/user-context'

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
  const [success, setSuccess] = useState<string|null>(null)
  const [newToken, setNewToken] = useState<string|null>(null)
  const [copied, setCopied] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // derive the effective user id from prop, UserContext, or meta tag
  let effectiveUserId: string | undefined = undefined
  try {
    const user = useUserContext()
    effectiveUserId = user?.id
  } catch (e) {
    // not inside a UserProvider or meta missing
  }
  function normalizeUserId(id?: string|null){ if(!id) return undefined; if(id === 'undefined') return undefined; return id }
  effectiveUserId = normalizeUserId(userId ?? effectiveUserId ?? getMeta('ol-user_id'))

  useEffect(()=>{ fetchTokens() }, [])

  async function fetchTokens(){
    setError(null)
    if (!effectiveUserId) return
    try{
      const data = await getJSON(`/internal/api/users/${effectiveUserId}/git-tokens`)
      setTokens(Array.isArray(data) ? data : [])
    }catch(e){
      // Treat 404/401 as an empty list (dev proxy or auth issues in E2E environments)
      const status = (e as any)?.response?.status
      if (status === 404 || status === 401) {
        console.debug('GitTokensPanel: token list fetch returned', status, '— treating as empty list')
        setTokens([])
        setError(null)
      } else {
        // log url/status for debugging in E2E
        try { console.error('Failed to fetch git tokens', (e as any).url || '(no url)', e) } catch (err) { console.error('Failed to fetch git tokens', e) }
        setError(getUserFacingMessage(e as any) ?? String(e))
      }
    }
  }

  async function createToken(e: React.FormEvent){
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setNewToken(null)
    setCopied(false)
    setIsCreating(true)
    try{
      const res = await postJSON(`/internal/api/users/${effectiveUserId}/git-tokens`, { body: { label } })
      // API returns { id, token, accessTokenPartial }
      setNewToken(res.token || null)
      setLabel('')
      await fetchTokens()
      setSuccess('Token created — copy it now; it will be shown only once.')
    }catch(err){
      setError(getUserFacingMessage(err as any) ?? String(err))
    } finally { setIsCreating(false) }
  }

  async function revokeToken(id: string){
    if(!confirm('Revoke this token?')) return
    setError(null); setSuccess(null)
    try{
      await deleteJSON(`/internal/api/users/${effectiveUserId}/git-tokens/${id}`)
      await fetchTokens()
      setSuccess('Token revoked')
    }catch(err){
      setError(getUserFacingMessage(err as any) ?? String(err))
    }
  }

  async function copyTokenToClipboard(token: string){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(token)
      }else{
        const ta = document.createElement('textarea')
        ta.value = token
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(()=>setCopied(false), 3000)
    }catch(e){
      setError('Failed to copy token to clipboard')
    }
  }

  return (
    <div className="git-tokens-panel">
      <h2>Personal Access Tokens</h2>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      <form onSubmit={createToken}>
        <label>
          Label
          <input value={label} onChange={e=>setLabel(e.target.value)} maxLength={64} />
        </label>
        <button type="submit" disabled={isCreating || label.trim() === ''}>{isCreating ? 'Creating…' : 'Create Token'}</button>
      </form>

      {newToken ? (
        <div className="new-token">
          <p>Copy this token now — it will be shown only once.</p>
          <pre style={{whiteSpace: 'break-spaces'}}>{newToken}</pre>
          <div className="new-token-actions">
            <button aria-label="Copy token to clipboard" onClick={()=>copyTokenToClipboard(newToken)} disabled={copied}>{copied ? 'Copied' : 'Copy'}</button>
            <button aria-label="Close token preview" onClick={()=>setNewToken(null)}>Close</button>
          </div>
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
